const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e) {
        console.log("Unauthorized access: "+currentUser.e);
        return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    if (endpoint[0] === "me") {
        if (method === "GET") return { s: 200, j: true, d: { user: currentUser } };
        else if (method === "PATCH") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.name || !body.data.nameprivacy) return { s: 400, j: true, d: { e: "Invalid request body" } };
            return await sql.editUser(currentUser.id, body.data.name, body.data.nameprivacy).then(res => {
                if (res.success) {
                    return { s: 200, j: true, d: { e: "User updated successfully" } };
                }
                else {
                    console.error("Database error:", err);
                    return { s: 500, j: true, d: { e: "Internal server error" } };
                }
            }).catch(err => {
                console.error("Database error:", err);
                return { s: 500, j: true, d: { e: "Internal server error" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 400, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
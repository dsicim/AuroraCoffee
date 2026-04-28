const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e) {
        console.log("Unauthorized access: "+currentUser.e);
        return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    if (endpoint[0] === "me") {
        if (method === "GET") return { s: 200, j: true, d: { user: currentUser } };
        else if (method === "PATCH") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.name || !body.data.privacy) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if (body.data.name.trim().split(" ").length < 2) return { s: 400, j: true, d: { e: "Please enter your name and surname" } };
            const userwords = currentUser.displayname.split(" ").map(s => s.trim()).filter(s => s.length > 0);
            let privacyinvalid = false;
            const userprivacy = body.data.privacy.split("").map(s => {
                if (!["s","h","i"].includes(s)) privacyinvalid = true;
                return privacyinvalid?null:{"s":"SHOW", "h":"HIDE", "i":"INITIAL"}[s];
            })
            if (userprivacy.length === 0) return { s: 400, j: true, d: { e: "Privacy setting is required" } };
            if (userprivacy.length !== userwords.length) return { s: 400, j: true, d: { e: "Privacy setting length must match the number of words in your display name" } };
            if (privacyinvalid) return { s: 400, j: true, d: { e: "Invalid privacy setting" } };
            return await sql.editUser(currentUser.id, body.data.name, body.data.privacy).then(res => {
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
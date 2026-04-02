const sql = require("../../Database/server.js");
async function handleAPI(method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e) {
        console.log("Unauthorized access: "+currentUser.e);
        return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    if (endpoint[0] === "me") {
        if (method === "GET") return { s: 200, j: true, d: { user: currentUser } };
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 400, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
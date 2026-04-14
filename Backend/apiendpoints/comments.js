const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (method === "POST") {
            return { s: 500, j: true, d: { e: "Not implemented yet" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not found" } };
}
module.exports = { handleAPI };
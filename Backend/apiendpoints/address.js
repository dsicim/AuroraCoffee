const sql = require("../../Database/server.js");
const crypto = require("crypto");
const aes = require("../aes256.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
    if (endpoint.length === 0) {
        return { s: 500, j: true, d: { e: "Not implemented yet" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
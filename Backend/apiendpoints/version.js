const version = require('./version.js');
async function handleAPI(method, endpoint, query, body, headers, currentUser) {
    if (endpoint[0] === "latest") {
        const uptodate = await version.getUpToDateVersion().then(res => res.s ? res.v : null).catch(err => null);
        return { s: 200, j: false, d: uptodate || "Error: Failed to fetch latest version", h: { "Access-Control-Allow-Origin": "*" } };
    }
    return { s: 200, j: false, d: config.version, h: { "Access-Control-Allow-Origin": "*" } };
}
module.exports = { handleAPI };
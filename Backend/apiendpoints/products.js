const sql = require("../../Database/server.js");
async function handleAPI(method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (method === "GET") {
            if (query.ids) {
                const ids = query.ids.split(",").map(x => parseInt(x)).filter(x => !isNaN(x));
                if (ids.length > 0) {
                    return await sql.getProductsByIds(ids).then(async result => {
                        if (result.success) {
                            return { s: 200, j: true, d: { products: result.products, idsnotfound: result.idsnotfound } };
                        }
                        else {
                            return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                        }
                    }).catch(err => {
                        console.error("Get products by IDs error:", err);
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else return { s: 400, j: true, d: { e: "All IDs are invalid" } };
            }
            else return { s: 400, j: true, d: { e: "Missing ids query parameter" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "all") {
        return { s: 501, j: true, d: { e: "Not Implemented" } };
    }
    else if (endpoint[0] === "search") {
        return { s: 501, j: true, d: { e: "Not Implemented" } };
    }
    else if (endpoint[0] === "add") {
        return { s: 501, j: true, d: { e: "Not Implemented" } };
    }
}
module.exports = { handleAPI };
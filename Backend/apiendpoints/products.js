const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    const userId = currentUser && !currentUser.e && currentUser.id ? currentUser.id : null;
    if (endpoint.length === 0) {
        if (method === "GET") {
            if (query.ids || query.urls) {
                const ids = query.ids ? query.ids.split(",").map(x => parseInt(x)).filter(x => !isNaN(x)) : query.urls.split(",").map(x => x.trim()).filter(x => x.length > 0);
                if (ids.length > 0) {
                    return await sql.getProductsByIds(userId,ids,Boolean(query.urls && !query.ids)).then(async result => {
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
        if (method === "GET") {
            return await sql.getAllProducts(userId).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { products: result.products } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get all products error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "search") {
        if (method === "GET") {
            if (query.q && query.q.trim().length > 0) {
                return await sql.searchProducts(userId, query.q.trim(),query.s ? (["newest", "oldest", "price_asc", "price_desc"].includes(query.s.trim())) ? query.s : "newest" : "newest").then(async result => {
                    if (result.success) {
                        return { s: 200, j: true, d: { products: result.products } };
                    }
                    else {
                        return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                    }
                }).catch(err => {
                    console.error("Search products error:", err);
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else return { s: 400, j: true, d: { e: "Q query parameter is required" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "categories") {
        if (method === "GET") {
            
        }
        return { s: 501, j: true, d: { e: "Not Implemented" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
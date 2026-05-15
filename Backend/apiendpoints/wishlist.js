const sql = require("../../Database/server.js");

async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (method === "GET") {
            if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
            return await sql.getWishlists(currentUser.id).then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { wishlist: result.wishlist } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get wishlists error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "POST") {
            if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
            return await sql.addToWishlist(currentUser.id, body.data.id).then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: result.message || "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Add to wishlist error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "DELETE") {
            if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!query || !query.id) return { s: 400, j: true, d: { e: "Product ID is required in query parameters" } };
            return await sql.removeFromWishlist(currentUser.id, query.id).then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: result.message || "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Remove from wishlist error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "users") {
        if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (!["Admin", "Product Manager", "Sales Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
        if (method !== "GET") return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        if (!query || !query.id) return { s: 400, j: true, d: { e: "Product ID is required in query parameters" } };
        return await sql.getUsersWishingForProduct(query.id).then(result => {
            if (result.success) {
                return { s: 200, j: true, d: { users: result.users } };
            }
            else {
                return { s: 400, j: true, d: { e: "An unknown error occurred" } };
            }
        }).catch(err => {
            console.error("Get users wishing for product error:", err);
            if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
            else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
        });
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
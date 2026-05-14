const sql = require("../../Database/server.js");

async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        return { s: 500, j: true, d: { e: "Not Implemented" } };
        return await sql.getWishlists(currentUser.id).then(result => {
            if (result.success) {
                return { s: 200, j: true, d: { wishlist: result.wishlist } };
            }
            else {
                return { s: 400, j: true, d: { e: "An unknown error occurred" } };
            }
        }).catch(err => {
            console.error("Get cart error:", err);
            if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
            else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
        });
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (currentUser && !currentUser.e) {
            if (method === "GET") { // Get all cart items
                return await sql.getCart(currentUser.id).then(result => {
                    if (result.success) {
                        return { s: 200, j: true, d: { cart: result.cart } };
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
            else if (method === "POST") { // Add item to cart
                if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.productId) return { s: 400, j: true, d: { e: "Invalid request body" } };
                return await sql.addToCart(currentUser.id, body.data.productId, body.data.quantity || 1, body.data.options || null).then(result => {
                    if (result.success) return { s: 200, j: true, d: { msg: "Item added to cart" } };
                    else return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else if (method === "PUT") { // Replace entire cart
                console.log("Replace cart body:", body);
                return { s: 500, j: true, d: { e: "Not implemented yet" } };
            }
            else if (method === "PATCH") { // Update cart item (quantity or options)
                if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.itemId) return { s: 400, j: true, d: { e: "Invalid request body" } };
                return await sql.modifyCartItem(currentUser.id, body.data.itemId, body.data.quantity, body.data.options).then(result => {
                    if (result.success) return { s: 200, j: true, d: { msg: "Cart item updated" } };
                    else return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else if (method === "DELETE") { // Remove item from cart
                if (query.item) {
                    return await sql.deleteCartItem(currentUser.id, query.item).then(result => {
                        if (result.success) return { s: 200, j: true, d: { msg: "Item removed from cart" } };
                        else return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                    }).catch(err => {
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else if (query.clear && query.clear === "true") {
                    return await sql.clearCart(currentUser.id).then(result => {
                        if (result.success) return { s: 200, j: true, d: { msg: "Cart cleared" } };
                        else return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                    }).catch(err => {
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                return { s: 400, j: true, d: { e: "Invalid query parameters" } };
            }
            else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
        else if (method === "GET") { // Guest trying to view cart using get (not allowed)
            return { s: 401, j: true, d: { e: "Unauthorized", msg: "Psst! Guest users can see their cart details. Just send the same request as a POST request and send the cart data stored in localStorage as the body to see the cart." } };
        }
        else if (method === "POST") { // Guest cart viewing for order summary page. User sends the cart data stored in localStorage to view the order summary before checkout.
            const cartData = body && body.exists && body.json && !body.err && body.data ? body.data : null;
            console.log("Guest cart data:", cartData);
            return { s: 500, j: true, d: { e: "Not implemented yet" } };
        }
        else return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
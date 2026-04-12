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
                if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
                return await sql.addToCart(currentUser.id, body.data.id, body.data.qty || 1, JSON.stringify(body.data.opt || {}), body.data.variantId || null).then(result => {
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
                if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
                return await sql.modifyCartItem(currentUser.id, body.data.id, body.data.qty, JSON.stringify(body.data.opt || {})).then(result => {
                    if (result.success) return { s: 200, j: true, d: { msg: "Cart item updated" } };
                    else return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else if (method === "DELETE") { // Remove item from cart
                if (query.id) {
                    return await sql.deleteCartItem(currentUser.id, query.id).then(result => {
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
            let cartData = body && body.exists && body.json && !body.err && body.data ? body.data : null;
            if (!cartData || !Array.isArray(cartData)) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const productsMentioned = [];
            cartData.forEach(item => {
                if (item.id && !productsMentioned.includes(item.id) && !isNaN(parseInt(item.id))) productsMentioned.push(parseInt(item.id));
            });
            const products = (productsMentioned.length > 0) ? await sql.getProductsByIds(productsMentioned).then(async result => {
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
            }) : { s: 200, j: true, d: {products: [], idsnotfound: [] } };
            if (products.s !== 200) return products;
            let productsMap = {};
            products.d.products.forEach(p => {
                productsMap[p.id] = p;
            });
            cartData.forEach(item => {
                if (item.id && productsMap[item.id]) {
                    item.valid = true;
                    item.name = productsMap[item.id].name;
                    item.price = productsMap[item.id].price;
                    item.stock = productsMap[item.id].stock;
                    item.category = productsMap[item.id].category_name;
                    item.parentcategory = productsMap[item.id].parent_category_name;
                }
                else if (item.id && products.d.idsnotfound.includes(item.id)) {
                    item.valid = false;
                    item.e = "Product ID not found";
                }
                else {
                    item.valid = false;
                    item.e = "Product ID is missing or invalid";
                }
            });
            return { s: 200, j: true, d: { cart: cartData, idsnotfound: products.d.idsnotfound } };
        }
        else return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
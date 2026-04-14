const sql = require("../../Database/server.js");
function validateOptions(product, opt, variant, ignoreRequired = false) {
    const o = product.options ? product.options : [];
    const expectedopt = [];
    const validopt = [];
    let expectedvar = false;
    let invalid = false;
    o.forEach(g => {
        if (g.store_as_variant) expectedvar = true;
        else {
            const optitem = {
                code: g.group_code,
                values: g.values.map(v => v.value_code)
            }
            if (g.is_required && !g.store_as_variant) {
                expectedopt.push(optitem);
                if (!opt || !opt[optitem.code] || !optitem.values.includes(String(opt[optitem.code]))) invalid = true;
            }
            validopt.push(optitem);
        }
    });
    let editvariant = false;
    if (invalid && (!ignoreRequired || opt)) return { s: false, e: "Invalid or missing required options" };
    if (expectedvar && (!variant || !variant.length) && !ignoreRequired) return { s: false, e: "Variant information is required for this product" };
    if (expectedvar) {
        const variants = product.variants ? product.variants.map(v => {return {code:v.variant_code,id:v.id}}) : [];
        const variantObj = variants.find(v => v.code === variant);
        if (!variantObj && (!ignoreRequired || variant)) return { s: false, e: "Invalid variant selected" };
        if (variantObj) {
            editvariant = true;
            variant = variantObj.id;
        }
    }
    if (!ignoreRequired || opt) {
        for (let i = 0; i < Object.keys(opt || {}).length; i++) {
            const k = Object.keys(opt)[i];
            const option = validopt.find(v => v.code === k);
            if (option) {
                if (!option.values.includes(String(opt[k]))) return { s: false, e: "Option \""+k+"\" doesn't have \""+opt[k]+"\" as a possible option for this product" };
            }
            else return { s: false, e: "Option \""+k+"\" doesn't exist for this product" };
        }
    }
    if (editvariant) return { s: true, variant: variant };
    return { s: true };
}


async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (currentUser && !currentUser.e) {
            if (method === "GET") { // Get all cart items
                return await sql.getCart(currentUser.id).then(result => {
                    if (result.success) {
                        return { s: 200, j: true, d: { cart: result.cart.map(item => {try {item.options = JSON.parse(item.options);} catch (e) {};return item;}) } };
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
                const product = await sql.getProductsByIds([body.data.id]).then(async result => {
                    if (result.success) {
                        const productObj = {};
                        result.products.forEach(p => {
                            productObj[p.id] = p;
                        });
                        return { s: true, product: productObj, idsnotfound: result.idsnotfound };
                    }
                    else {
                        return { s: false, e: "Unknown error checking the product" };
                    }
                }).catch(err => {
                    console.error("Get products by IDs error:", err);
                    if (err instanceof sql.DBError) return { s: false, e: err.error || "Unknown error checking the product" };
                    else return { s: false, e: "Unknown error checking the product" };
                });
                if (!product.s && product.e && product.e === "No products found") return { s: 400, j: true, d: { e: "Product ID not found" } };
                if (!product.s) return { s: 400, j: true, d: { e: product.e || "An unknown error occurred" } };
                if (!product.product) return { s: 400, j: true, d: { e: "Product ID not found" } };
                const validation = validateOptions(product.product[body.data.id], body.data.opt, body.data.var);
                if (!validation.s) return { s: 400, j: true, d: { e: validation.e } };
                if (validation.variant) body.data.var = validation.variant;
                console.log(product.product[body.data.id].variants, body.data.var);
                const stock = (product.product[body.data.id].has_variants) ? product.product[body.data.id].variants.find(v => v.id === body.data.var).stock : product.product[body.data.id].stock;
                const qty = body.data.qty;
                if (qty > stock) return { s: 400, j: true, d: { e: "Requested quantity exceeds available stock. Available stock: "+stock } };
                return await sql.addToCart(currentUser.id, body.data.id, body.data.qty || 1, JSON.stringify(body.data.opt || {}), body.data.var || null).then(result => {
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
                const cart = await sql.getCart(currentUser.id).then(result => {
                    if (result.success) {
                        return { s: true, cart: result.cart.map(item => {try {item.options = JSON.parse(item.options);} catch (e) {};return item;}) };
                    }
                    else {
                        return { s: false, e: "Failed to fetch cart" };
                    }
                }).catch(err => {
                    console.error("Get cart error:", err);
                    if (err instanceof sql.DBError) return { s: false, e: err.error || "Failed to fetch cart" };
                    else return { s: false, e: "Failed to fetch cart" };
                });
                if (!cart.s) return { s: 400, j: true, d: { e: cart.e || "Failed to fetch cart" } };
                const item = cart.cart.find(item => item.id === body.data.id);
                if (!item) return { s: 400, j: true, d: { e: "Item not found in cart" } };
                const product = await sql.getProductsByIds([item.product_id]).then(async result => {
                    if (result.success) {
                        const productObj = {};
                        result.products.forEach(p => {
                            productObj[p.id] = p;
                        });
                        return { s: true, product: productObj, idsnotfound: result.idsnotfound };
                    }
                    else {
                        return { s: false, e: "Unknown error checking the product" };
                    }
                }).catch(err => {
                    console.error("Get products by IDs error:", err);
                    if (err instanceof sql.DBError) return { s: false, e: err.error || "Unknown error checking the product" };
                    else return { s: false, e: "Unknown error checking the product" };
                });
                if (!product.s && product.e && product.e === "No products found") return { s: 400, j: true, d: { e: "Product ID not found" } };
                if (!product.s) return { s: 400, j: true, d: { e: product.e || "An unknown error occurred" } };
                if (!product.product) return { s: 400, j: true, d: { e: "Product ID not found" } };
                const validation = validateOptions(product.product[item.product_id], body.data.opt, body.data.var, true);
                if (!validation.s) return { s: 400, j: true, d: { e: validation.e } };
                if (validation.variant) body.data.var = validation.variant;
                const stock = (product.product[item.product_id].has_variants) ? product.product[item.product_id].variants.find(v => v.id === body.data.var?body.data.var:item.variant_id).stock : product.product[item.product_id].stock;
                const qty = body.data.qty || item.qty;
                if (qty > stock) return { s: 400, j: true, d: { e: "Requested quantity exceeds available stock. Available stock: "+stock } };
                return await sql.modifyCartItem(currentUser.id, body.data.id, body.data.qty, JSON.stringify(body.data.opt || {}), body.data.var || null).then(result => {
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
            cartData.forEach(item => {
                const validation = validateOptions(productsMap[item.id], item.opt, item.var);
                if (!validation.s) return { s: 400, j: true, d: { e: validation.e } };
            });
            return { s: 200, j: true, d: { cart: cartData, idsnotfound: products.d.idsnotfound } };
        }
        else return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
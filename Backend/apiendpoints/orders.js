const sql = require("../../Database/server.js");
const crypto = require("crypto");
const fetch = require("node-fetch");
const aes = require("../components/aes256.js");
const pdf = require("../invoice/pdf.js");
const currencymodule = require("../components/currency.js");
const payments = require("./payment.js");
const mailer = require("../components/email.js");
const fs = require("fs");

function sanitizeProductManagerOrder(order) {
    const details = order && typeof order.details === "object" ? order.details : {};
    const shippingAddress = details.shippingAddress && typeof details.shippingAddress === "object"
        ? details.shippingAddress
        : {};

    return {
        id: order.id,
        user_id: order.user_id,
        status: order.status,
        created_at: order.created_at,
        purchase_id: order.purchase_id,
        details: {
            products: Array.isArray(details.products) ? details.products : [],
            price: details.price && typeof details.price === "object" ? details.price : {},
            currency: details.currency,
            shippingAddress: shippingAddress
        }
    };
}
async function emailRefund(config, email, details) {
    const itemstemplate = fs.readFileSync("./emails/refundemailitems.html", "utf-8");
    let itemshtml = itemstemplate.replaceAll("{{ITEM_NAME}}", details.product.name)
        .replaceAll("{{ITEM_IMAGE_URL}}", details.product.product_image)
        .replaceAll("{{ITEM_OPTIONS}}", details.product.optionstext ? details.product.optionstext : "")
        .replaceAll("{{ITEM_AMOUNT}}", details.product.quantity)
        .replaceAll("{{ITEM_PRICE}}", currencymodule.currencyToSymbol(details.currency, details.product.product_price));
    const template = fs.readFileSync("./emails/refundemail.html", "utf-8")
        .replaceAll("{{ORDER_ID}}", details.orderNumber)
        .replaceAll("{{ORDER_URL}}", "https://" + config.domain + "/account/orders/" + details.orderNumber)
        .replaceAll("{{TOTAL_PRICE}}", currencymodule.currencyToSymbol(details.currency, details.product.product_price))
        .replaceAll("{{REFUNDED_ITEMS_HTML}}", itemshtml);
    return await mailer.sendEmail(email, "Your refund has been approved", template, []).then(res => {
        //console.log("Email sent:", res);
        return { s: true, res: res };
    }).catch(err => {
        return { s: false, err: err };
    });
}
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (method === "GET") {
            const specificorder = Boolean(query.id) ? query.id : null;
            const admin = (query.admin && (query.admin === "true" || query.admin === "1")) ? true : false;
            const canReadManagerOrders = ["Admin", "Sales Manager", "Product Manager"].includes(currentUser.role);
            async function getOrderResult(result) {
                if (result.success) {
                    const errors = [];
                    const orders = result.orders.map(ordr => {
                        try {
                            if (specificorder && specificorder != ordr.id) return undefined;
                            if (specificorder) {
                                ordr.details = aes.pjs(ordr.details);
                                if (ordr.details.e && ordr.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                                const decrypted = aes.decrypt(ordr.details, ordr.user_id);
                                if (!decrypted.s) throw new Error("Decryption failed");
                                const order = aes.pjs(decrypted.value);
                                if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                                ordr.details = order;
                                if (currentUser.role === "Product Manager") {
                                    const o = sanitizeProductManagerOrder(ordr);
                                    return { order: o };
                                }
                            }
                            else delete ordr.details;
                            return { order: ordr };
                        } catch (err) {
                            console.error("Decrypt order error:", err);
                            errors.push({ id: ordr.id, e: err.toString() });
                            return { order: undefined, e: err.toString() };
                        }
                    }).filter(ordr => ordr !== undefined);
                    if (orders.length === 0 && specificorder) return { s: 404, j: true, d: { e: "Order not found" } };
                    return specificorder ? { s: 200, j: true, d: { order: orders[0] } } : { s: 200, j: true, d: { orders, errors } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }
            function getOrderError(err) {
                console.error("Get orders error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }
            if (admin && canReadManagerOrders) return await sql.getAllOrders(specificorder).then(getOrderResult).catch(getOrderError);
            else return await sql.getUserOrders(currentUser.id, specificorder).then(getOrderResult).catch(getOrderError);
        }
        else return { s: 405, j: true, d: { e: "Method not allowed" } };
    }
    else if (endpoint[0] === "refund") {
        if (endpoint.length === 1) {
            if (method === "POST") {
                if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
                if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.cartId || !body.data.message) return { s: 400, j: true, d: { e: "Invalid request body" } };
                const orderId = body.data.id;
                const cartId = body.data.cartId;
                const message = body.data.message;
                const result = await sql.getUserOrders(currentUser.id, orderId).then(result => {
                    if (result.success) {
                        const errors = [];
                        const orders = result.orders.map(ordr => {
                            try {
                                if (orderId && orderId != ordr.id) return undefined;
                                ordr.details = aes.pjs(ordr.details);
                                if (ordr.details.e && ordr.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                                const decrypted = aes.decrypt(ordr.details, currentUser.id);
                                if (!decrypted.s) throw new Error("Decryption failed");
                                const order = aes.pjs(decrypted.value);
                                if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                                ordr.details = order;
                                return { order: ordr };
                            } catch (err) {
                                console.error("Decrypt order error:", err);
                                errors.push({ id: ordr.id, e: err.toString() });
                                return { order: undefined, e: err.toString() };
                            }
                        }).filter(ordr => ordr !== undefined);
                        if (orders.length === 0 && orderId) return { s: 404, j: true, d: { e: "Order not found" } };
                        return orderId ? { s: 200, j: true, d: { order: orders[0] } } : { s: 200, j: true, d: { orders, errors } };
                    }
                    else return { s: 400, e: result.message || "An unknown error occurred" };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, e: err.error || "An unknown error occurred" };
                    else return { s: 500, e: "An unknown error occurred" };
                });
                if (result.s !== 200) return { s: result.s, j: true, d: { e: result.e } };
                if (result.d.order.order.status !== "delivered") return { s: 400, j: true, d: { e: "Only delivered orders can be refunded" } };
                const thirtyDaysAgo = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
                if (result.d.order.order.created_at < thirtyDaysAgo) return { s: 400, j: true, d: { e: "Refund can only be requested within 30 days of purchase" } };
                let product = -1
                result.d.order.order.details.products.forEach((p, i) => { if (p.id === cartId) product = i });
                if (product === -1) return { s: 400, j: true, d: { e: "Product not found in order" } };
                if (result.d.order.order.details.products[product].refundRequested) return { s: 400, j: true, d: { e: "Refund for this product has already been requested" } };
                result.d.order.order.details.products[product].refundRequested = true;
                result.d.order.order.details.products[product].refundMessage = message;
                const encryptedDetails = aes.encrypt(JSON.stringify(result.d.order.order.details), currentUser.id);
                return await sql.updateOrderDetails(orderId, JSON.stringify(encryptedDetails)).then(res => {
                    if (res.success) return { s: 200, j: true, d: { message: "Refund request submitted successfully", refundNumber: orderId + "-" + result.d.order.order.details.products[product].id } };
                    else return { s: 400, j: true, d: { e: res.e || "An unknown error occurred" } };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else return { s: 405, j: true, d: { e: "Method not allowed" } };
        }
        else if (endpoint[1] === "approve" || endpoint[1] === "reject") {
            if (method === "POST") {
                if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
                if (!["Admin", "Sales Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
                if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || body.data.cartId === undefined || body.data.cartId === null || body.data.cartId === "") return { s: 400, j: true, d: { e: "Invalid request body" } };
                const orderId = body.data.id;
                const cartId = body.data.cartId;
                const result = await sql.getAllOrders(orderId).then(result => {
                    if (result.success) {
                        const errors = [];
                        const orders = result.orders.map(ordr => {
                            try {
                                if (orderId && orderId != ordr.id) return undefined;
                                ordr.details = aes.pjs(ordr.details);
                                if (ordr.details.e && ordr.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                                const decrypted = aes.decrypt(ordr.details, ordr.user_id);
                                if (!decrypted.s) throw new Error("Decryption failed");
                                const order = aes.pjs(decrypted.value);
                                if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                                ordr.details = order;
                                return { order: ordr };
                            } catch (err) {
                                console.error("Decrypt order error:", err);
                                errors.push({ id: ordr.id, e: err.toString() });
                                return { order: undefined, e: err.toString() };
                            }
                        }).filter(ordr => ordr !== undefined);
                        if (orders.length === 0 && orderId) return { s: 404, j: true, d: { e: "Order not found" } };
                        return orderId ? { s: 200, j: true, d: { order: orders[0] } } : { s: 200, j: true, d: { orders, errors } };
                    }
                    else return { s: 400, e: result.message || "An unknown error occurred" };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, e: err.error || "An unknown error occurred" };
                    else return { s: 500, e: "An unknown error occurred" };
                });
                if (result.s !== 200) return { s: result.s, j: true, d: { e: result.e } };
                let product = -1
                result.d.order.order.details.products.forEach((p, i) => { if (p.id === cartId) product = i });
                if (product === -1) return { s: 400, j: true, d: { e: "Product not found in order" } };
                if (!result.d.order.order.details.products[product].refundRequested) return { s: 400, j: true, d: { e: "No pending refund request found for this product" } };
                let emailaddr = null;
                let restock = null;
                if (endpoint[1] === "approve") {
                    emailaddr = await sql.findUser(result.d.order.order.user_id, true).then(res => {
                        return res.success ? res.user.username : null;
                    }).catch(err => {
                        return null;
                    });
                    if (!emailaddr) return { s: 400, j: true, d: { e: "Failed to find user for the order" } };
                    result.d.order.order.details.products[product].refunded = true;
                    result.d.order.order.details.products[product].refundRequested = false;
                    result.d.order.order.details.products[product].refundRejected = false;
                    const full = result.d.order.order.details.products[product].product_price - (result.d.order.order.details.products[product].pricededuction || 0);
                    const installmentInterest = result.d.order.order.details.price.installment / result.d.order.order.details.price.total;
                    const fullWithInterest = (installmentInterest + 1) * full;
                    const refundResult = await payments.IyzipayAPI(config, "POST", "v2/payment/refund", {}, { "locale": "en", "price": fullWithInterest, "paymentId": result.d.order.order.purchaseId, "currency": result.d.order.order.details.currency }).then(res => {
                        if (res.status == "success") return { success: true, message: "Payment refunded successfully" };
                        else return { success: false, message: "Failed to refund payment: " + res.errorMessage };
                    }).catch(err => {
                        console.error("Payment cancellation error:", err);
                        return { success: false, message: "Failed to refund payment: " + err.toString() };
                    });
                    if (!refundResult.success) {
                        return { s: 400, j: true, d: { e: refundResult.message } };
                    }
                    restock = {
                        productId: result.d.order.order.details.products[product].product_id,
                        variantId: result.d.order.order.details.products[product].variant_id,
                        quantity: result.d.order.order.details.products[product].quantity
                    }
                }
                else {
                    result.d.order.order.details.products[product].refundRequested = false;
                    result.d.order.order.details.products[product].refundRejected = true;
                }
                console.log(restock);
                const encryptedDetails = aes.encrypt(JSON.stringify(result.d.order.order.details), result.d.order.order.user_id);
                
                return await sql.updateOrderDetails(orderId, JSON.stringify(encryptedDetails), restock).then(async res => {
                    if (res.success) {
                        if (endpoint[1] === "approve") {
                            const emaildetails = {
                                product: {
                                    name: result.d.order.order.details.products[product].product_name,
                                    optionstext: result.d.order.order.details.products[product].optionstext,
                                    product_image: result.d.order.order.details.products[product].product_image,
                                    quantity: result.d.order.order.details.products[product].quantity,
                                    product_price: result.d.order.order.details.products[product].product_price
                                },
                                orderNumber: result.d.order.order.id,
                                currency: result.d.order.order.details.currency
                            }
                            const emailResult = await emailRefund(config, emailaddr, emaildetails).then(r => {
                                if (r.s) return { success: true, res: r.res };
                                else return { success: false, err: r.err };
                            }).catch(err => {
                                return { success: false, err: err };
                            });
                            if (!emailResult.success) {
                                return { s: 400, j: true, d: { e: "Refund was processed but failed to send email notification: " + emailResult.err.toString() } };
                            }
                        }
                        return { s: 200, j: true, d: { message: (endpoint[1] === "approve") ? "Refund processed successfully" : "Refund request rejected successfully" } };
                    }
                    else return { s: 400, j: true, d: { e: res.e || "An unknown error occurred" } };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else return { s: 405, j: true, d: { e: "Method not allowed" } };
        }
        else return { s: 404, j: true, d: { e: "Not Found" } };
    }
    else if (endpoint[0] === "cancel") {
        if (method === "POST") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const admin = Boolean(body.data.admin) && ["Admin", "Sales Manager", "Product Manager"].includes(currentUser.role);
            const orderId = body.data.id;
            function getOrderResult(result) {
                if (result.success) {
                    const errors = [];
                    const orders = result.orders.map(ordr => {
                        try {
                            if (orderId && orderId != ordr.id) return undefined;
                            ordr.details = aes.pjs(ordr.details);
                            if (ordr.details.e && ordr.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                            const decrypted = aes.decrypt(ordr.details, ordr.user_id);
                            if (!decrypted.s) throw new Error("Decryption failed");
                            const order = aes.pjs(decrypted.value);
                            if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                            ordr.details = order;
                            return { order: ordr };
                        } catch (err) {
                            console.error("Decrypt order error:", err);
                            errors.push({ id: ordr.id, e: err.toString() });
                            return { order: undefined, e: err.toString() };
                        }
                    }).filter(ordr => ordr !== undefined);
                    if (orders.length === 0 && orderId) return { s: 404, j: true, d: { e: "Order not found" } };
                    return orderId ? { s: 200, j: true, d: { order: orders[0] } } : { s: 200, j: true, d: { orders, errors } };
                }
                else return { s: 400, e: result.message || "An unknown error occurred" };
            }
            function getOrderError(err) {
                console.error("Get orders error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }
            const result = admin ? await sql.getAllOrders(orderId).then(getOrderResult).catch(getOrderError) : await sql.getUserOrders(currentUser.id, orderId).then(getOrderResult).catch(getOrderError);
            if (result.s !== 200) return { s: result.s, j: true, d: { e: result.e } };
            if (result.d.order.order.status === "cancelled") return { s: 400, j: true, d: { e: "Order is already cancelled" } };
            console.log("Attempting to cancel order:", result.d.order.order);
            if (["shipped", "delivered"].includes(result.d.order.order.status)) return { s: 400, j: true, d: { e: `Cannot cancel order in ${result.d.order.order.status} status` } };
            const refundResult = await payments.IyzipayAPI(config, "POST", "payment/cancel", {}, { locale: "en", paymentId: result.d.order.order.purchaseId }).then(res => {
                if (res.status == "success") return { success: true, message: "Order cancelled and payment refunded successfully" };
                else return { success: false, message: "Failed to refund payment: " + res.errorMessage };
            }).catch(err => {
                console.error("Payment cancellation error:", err);
                return { success: false, message: "Failed to refund payment: " + err.toString() };
            });
            if (refundResult.message == "Failed to refund payment: Transaction has already been cancelled") refundResult.success = true; // This means the order was already cancelled/refunded on the payment provider, so we can treat it as a success for our purposes.
            if (refundResult.message == "Failed to refund payment: Process has been locked before") refundResult.success = true; // This means the order was already cancelled/refunded on the payment provider, so we can treat it as a success for our purposes.
            if (!refundResult.success) {
                return { s: 500, j: true, d: { e: "Failed to cancel payment: " + refundResult.message } };
            }
            else {
                return await sql.cancelOrder(orderId, admin ? result.user_id : currentUser.id, result.d.order.order.details.products).then(res => {
                    if (res.success) return { s: 200, j: true, d: { message: res.message } };
                    else return { s: 400, j: true, d: { e: res.e || "An unknown error occurred" } };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
        }
        else return { s: 405, j: true, d: { e: "Method not allowed" } };
    }
    else if (endpoint[0] === "pdf") {
        if (method === "GET") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!query || !query.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const specificorder = Boolean(query.id) ? query.id : null;
            if (!specificorder) return { s: 400, j: true, d: { e: "Order ID is required" } };
            const admin = (query.admin && (query.admin === "true" || query.admin === "1")) && ["Admin", "Sales Manager", "Product Manager"].includes(currentUser.role);
            async function getOrderResult(result) {
                if (result.success) {
                    const errors = [];
                    const ordr = result.orders.find(o => o.id === specificorder);
                    if (!ordr) return { s: 404, j: true, d: { e: "Order not found" } };
                    try {
                        ordr.details = aes.pjs(ordr.details);
                        if (ordr.details.e && ordr.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                        const decrypted = aes.decrypt(ordr.details, ordr.user_id);
                        if (!decrypted.s) throw new Error("Decryption failed");
                        const order = aes.pjs(decrypted.value);
                        if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                        ordr.details = order;
                        return await pdf.generatePDF(ordr).then(document => {
                            return { s: 200, j: false, d: document, h: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=invoice.pdf", "Content-Length": Buffer.byteLength(document) } };
                        }).catch(err => {
                            return { s: 500, j: true, d: { e: "Issue with PDF rendering: " + err.toString() } };
                        });
                    } catch (err) {
                        console.error("Generate PDF error:", err);
                        return { s: 500, j: true, d: { e: err.toString() } };
                    }
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }
            function getOrderError(err) {
                console.error("Get orders error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }
            if (admin) return await sql.getAllOrders(specificorder).then(getOrderResult).catch(getOrderError);
            else return await sql.getUserOrders(currentUser.id, specificorder).then(getOrderResult).catch(getOrderError);
        }
        else return { s: 405, j: true, d: { e: "Method not allowed" } };
    }
    else if (endpoint[0] === "status") {
        if (method === "PATCH") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Sales Manager", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.status) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if (currentUser.role === "Product Manager") {
                const productManagerStatusTransitions = {
                    processing: "shipped",
                    shipped: "delivered",
                };
                if (!Object.values(productManagerStatusTransitions).includes(body.data.status)) return { s: 403, j: true, d: { e: "Product Managers can only mark processing orders as shipped or shipped orders as delivered" } };
                const orderResult = await sql.getAllOrders(body.data.id).catch(err => {
                    console.error("Product manager status order lookup error:", err);
                    return null;
                });
                if (!orderResult || !orderResult.success) return { s: 400, j: true, d: { e: "Could not verify order status" } };
                const targetOrder = orderResult.orders.find(order => String(order.id) === String(body.data.id));
                if (!targetOrder) return { s: 404, j: true, d: { e: "Order not found" } };
                if (productManagerStatusTransitions[targetOrder.status] !== body.data.status) return { s: 400, j: true, d: { e: "Product Managers can only mark processing orders as shipped or shipped orders as delivered" } };
            }
            const updateResult = await sql.updateOrderStatus(body.data.id, body.data.status).then(result => {
                if (result.success) return { s: 200, j: true, d: { msg: "Order status updated successfully" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }).catch(err => {
                if (err instanceof sql.DBError) return { s: 400, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
            if (updateResult.s && body.data.status === "delivered") {
                // We can mark the user able to comment on products
                return await sql.getOrder(body.data.id).then(async result => {
                    if (result.success) {
                        result.order.details = aes.pjs(result.order.details);
                        if (result.order.details.e && result.order.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                        const decrypted = aes.decrypt(result.order.details, result.order.user_id);
                        if (!decrypted.s) throw new Error("Decryption failed");
                        const order = aes.pjs(decrypted.value);
                        if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                        const allProducts = order.products.map(p => ({ product_id: p.product_id, variant_id: p.variant_id, details: { options: p.options } }));
                        return await sql.addDeliveredItems(result.order.user_id, allProducts).then(result => {
                            if (result.success) return { s: 200, j: true, d: { msg: "Order status updated successfully. The user now can comment on products." } };
                            else return { s: 500, j: true, d: { e: "An unknown error occurred" } };;
                        }).catch(err => {
                            if (err instanceof sql.DBError) return { s: 400, j: true, d: { e: err.error || "An unknown error occurred" } };
                            else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                        });
                    }
                }).catch(err => {
                    console.error(err);
                    if (err instanceof sql.DBError) return { s: 400, j: true, d: { e: err.error || "An unknown error occurred while getting order" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred while getting order" } };
                });
            }
            return updateResult;
        }
        else return { s: 405, j: true, d: { e: "Method not allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not found" } };
}

module.exports = { handleAPI };

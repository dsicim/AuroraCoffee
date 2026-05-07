const sql = require("../../Database/server.js");
const crypto = require("crypto");
const fetch = require("node-fetch");
const aes = require("../components/aes256.js");
const pdf = require("../invoice/pdf.js");

async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (method === "GET") {
            const specificorder = Boolean(query.id) ? query.id : null;
            const admin = (query.admin && (query.admin === "true" || query.admin === "1")) ? true : false;
            if (admin && !["Admin","Sales Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (admin) return await sql.getAllOrders(specificorder).then(async result => {
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
            }).catch(err => {
                console.error("Get orders error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
            else return await sql.getUserOrders(currentUser.id, specificorder).then(async result => {
                if (result.success) {
                    const errors = [];
                    const orders = result.orders.map(ordr => {
                        try {
                            if (specificorder && specificorder != ordr.id) return undefined;
                            if (specificorder) {
                                ordr.details = aes.pjs(ordr.details);
                                if (ordr.details.e && ordr.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                                const decrypted = aes.decrypt(ordr.details, currentUser.id);
                                if (!decrypted.s) throw new Error("Decryption failed");
                                const order = aes.pjs(decrypted.value);
                                if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                                ordr.details = order;
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
            }).catch(err => {
                console.error("Get orders error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method not allowed" } };
    }
    else if (endpoint[0] === "pdf") {
        if (method === "GET") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!query || !query.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const specificorder = Boolean(query.id) ? query.id : null;
            if (!specificorder) return { s: 400, j: true, d: { e: "Order ID is required" } };
            return await sql.getUserOrders(currentUser.id, specificorder).then(async result => {
                if (result.success) {
                    const errors = [];
                    const ordr = result.orders.find(o => o.id === specificorder);
                    if (!ordr) return { s: 404, j: true, d: { e: "Order not found" } };
                    try {
                        ordr.details = aes.pjs(ordr.details);
                        if (ordr.details.e && ordr.details.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                        const decrypted = aes.decrypt(ordr.details, currentUser.id);
                        if (!decrypted.s) throw new Error("Decryption failed");
                        const order = aes.pjs(decrypted.value);
                        if (order.e && order.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                        ordr.details = order;
                        return await pdf.generatePDF(ordr).then(document => {
                            return { s: 200, j: false, d: document, h: {"Content-Type": "application/pdf", "Content-Disposition": "inline; filename=invoice.pdf", "Content-Length": Buffer.byteLength(document)} };
                        }).catch(err => {
                            return { s: 500, j: true, d: { e: "Issue with PDF rendering: "+err.toString() } };
                        });
                    } catch (err) {
                        console.error("Generate PDF error:", err);
                        return { s: 500, j:true, d: { e: err.toString() } };
                    }
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get orders error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method not allowed" } };
    }
    else if (endpoint[0] === "status") {
        if (method === "PATCH") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.status) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const updateResult = await sql.updateOrderStatus(body.data.id, body.data.status).then(result => {
                if (result.success) return { s: 200, j:true, d: { msg: "Order status updated successfully" } };
                else return { s: 500, j:true, d: {e: "An unknown error occurred"} };
            }).catch(err => {
                if (err instanceof sql.DBError) return { s: 400, j:true, d: {e: err.error || "An unknown error occurred"} };
                else return { s: 500, j:true, d: {e: "An unknown error occurred"} };
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
                            if (result.success) return { s: 200, j:true, d: { msg: "Order status updated successfully. The user now can comment on products." } };
                            else return { s: 500, j:true, d: {e: "An unknown error occurred"} };;
                        }).catch(err => {
                            if (err instanceof sql.DBError) return { s: 400, j:true, d: {e: err.error || "An unknown error occurred"} };
                            else return { s: 500, j:true, d: {e: "An unknown error occurred"} };
                        });
                    }
                }).catch(err => {
                    console.error(err);
                    if (err instanceof sql.DBError) return { s: 400, j:true, d: {e: err.error || "An unknown error occurred while getting order"} };
                    else return { s: 500, j:true, d: {e: "An unknown error occurred while getting order"} };
                });
            }
            return updateResult;
        }
        else return { s: 405, j: true, d: { e: "Method not allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not found" } };
}

module.exports = { handleAPI };
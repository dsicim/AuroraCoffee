const sql = require("../../Database/server.js");
const aes = require("../components/aes256.js");

async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    const userId = currentUser && !currentUser.e && currentUser.id ? currentUser.id : null;
    const isManager = currentUser && !currentUser.e && ["Admin", "Product Manager", "Sales Manager"].includes(currentUser.role);

    if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
    if (!isManager) return { s: 403, j: true, d: { e: "Forbidden" } };

    if (endpoint.length === 0) {
        if (method === "GET") {
            const startDate = query.startDate || null;
            const endDate = query.endDate || null;

            return await sql.getAnalyticsData(startDate, endDate).then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { summary: result.summary, timeseries: result.timeseries } };
                } else {
                    return { s: 400, j: true, d: { e: "Failed to calculate analytics" } };
                }
            }).catch(err => {
                console.error("Get analytics data error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        } else {
            return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
    }
    else if (endpoint[0] === "sales") {
        if (method === "GET") {
            const startDate = query.startDate || null;
            const endDate = query.endDate || null;

            const allOrders = await sql.getAllOrders(specificorder, startDate, endDate).then(async result => {
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
                                    return { order: ordr.details.products };
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
            }).catch(err => {
                console.error("Get orders error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
            if (allOrders.s !== 200) return { s: allOrders.s, j: true, d: allOrders.d };
            return { s: 200, j: true, d: allOrders.d };
        }
    }
    return { s: 404, j: true, d: { e: "Not Found" } };
}

module.exports = { handleAPI };

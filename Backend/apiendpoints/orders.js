const sql = require("../../Database/server.js");
const crypto = require("crypto");
const fetch = require("node-fetch");
const aes = require("../aes256.js");


async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0) {
        if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (method === "GET") {
            const specificorder = Boolean(query.id) ? query.id : null;
            return await sql.getUserOrders(currentUser.id, specificorder).then(async result => {
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
    else if (endpoint[0] === "others") {
        return { s: 502, j: true, d: { e: "Not implemented yet" } };
    }
    else return { s: 404, j: true, d: { e: "Not found" } };
}

module.exports = { handleAPI };
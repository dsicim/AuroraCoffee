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
    return { s: 404, j: true, d: { e: "Not Found" } };
}

module.exports = { handleAPI };

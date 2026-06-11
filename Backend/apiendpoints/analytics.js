const sql = require("../../Database/server.js");

const analyticsRoles = new Set(["Admin", "Product Manager", "Sales Manager"]);

function normalizeDateParam(value, fieldName) {
    if (value === undefined || value === null || value === "") return null;

    const normalized = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        throw new sql.DBError(400, `${fieldName} must use YYYY-MM-DD format`);
    }

    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
        throw new sql.DBError(400, `${fieldName} must be a valid date`);
    }

    return normalized;
}

function getInclusiveEndDate(value) {
    if (!value) return null;

    return `${value} 23:59:59`;
}

function getAnalyticsDateRange(query = {}) {
    const rawStartDate = normalizeDateParam(query.startDate, "startDate");
    const rawEndDate = normalizeDateParam(query.endDate, "endDate");

    if (rawStartDate && rawEndDate && rawStartDate > rawEndDate) {
        return {
            startDate: rawEndDate,
            endDate: getInclusiveEndDate(rawStartDate),
        };
    }

    return {
        startDate: rawStartDate,
        endDate: getInclusiveEndDate(rawEndDate),
    };
}

async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    const userId = currentUser && !currentUser.e && currentUser.id ? currentUser.id : null;
    const isManager = currentUser && !currentUser.e && analyticsRoles.has(currentUser.role);

    if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
    if (!isManager) return { s: 403, j: true, d: { e: "Forbidden" } };

    if (endpoint.length === 0) {
        if (method === "GET") {
            try {
                const dateRange = getAnalyticsDateRange(query);
                const result = await sql.getAnalyticsData(dateRange.startDate, dateRange.endDate);

                if (result.success) {
                    return { s: 200, j: true, d: { summary: result.summary, timeseries: result.timeseries } };
                }

                return { s: 400, j: true, d: { e: "Failed to calculate analytics" } };
            } catch (err) {
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };

                console.error("Get analytics data error:", err);
                return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }
        } else {
            return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
    }
    return { s: 404, j: true, d: { e: "Not Found" } };
}

module.exports = { handleAPI };

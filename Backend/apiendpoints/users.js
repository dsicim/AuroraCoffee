const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e) {
        console.log("Unauthorized access: "+currentUser.e);
        return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    if (endpoint[0] === "me") {
        if (method === "GET") return { s: 200, j: true, d: { user: currentUser } };
        else if (method === "PATCH") {
            if (!body || !body.exists || body.err || !body.json || !body.data || ((!body.data.name || !body.data.privacy) && body.data.emailblock === undefined && body.data.taxId === undefined)) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if ((body.data.name && !body.data.privacy) || (!body.data.name && body.data.privacy)) return { s: 400, j: true, d: { e: "Display name and privacy must be provided together" } };
            if (!body.data.name && !body.data.privacy) {
                body.data.name = currentUser.displayname;
                body.data.privacy = currentUser.nameprivacy;
            }
            else {
                if (body.data.name.trim().split(" ").length < 2) return { s: 400, j: true, d: { e: "Please enter your name and surname" } };
                const userwords = body.data.name.split(" ").map(s => s.trim()).filter(s => s.length > 0);
                let privacyinvalid = false;
                const userprivacy = body.data.privacy.split("").map(s => {
                    if (!["s","h","i"].includes(s)) privacyinvalid = true;
                    return privacyinvalid?null:{"s":"SHOW", "h":"HIDE", "i":"INITIAL"}[s];
                })
                if (userprivacy.length === 0) return { s: 400, j: true, d: { e: "Privacy setting is required" } };
                if (userprivacy.length !== userwords.length) return { s: 400, j: true, d: { e: "Privacy setting length must match the number of words in your display name" } };
                if (privacyinvalid) return { s: 400, j: true, d: { e: "Invalid privacy setting" } };
            }
            const taxId = body.data.taxId === undefined ? currentUser.tax_id : body.data.taxId;
            if (taxId && taxId.length > 50) return { s: 400, j: true, d: { e: "Tax ID must be 50 characters or fewer" } };
            return await sql.editUser(currentUser.id, body.data.name, body.data.privacy, body.data.emailblock === undefined ? currentUser.emailblock : body.data.emailblock, taxId || null).then(res => {
                if (res.success) {
                    return { s: 200, j: true, d: { e: "User updated successfully" } };
                }
                else {
                    console.error("Database error:", err);
                    return { s: 500, j: true, d: { e: "Internal server error" } };
                }
            }).catch(err => {
                console.error("Database error:", err);
                return { s: 500, j: true, d: { e: "Internal server error" } };
            });
        }
        else if (method === "DELETE") {
            // DO NOT UNCOMMENT THIS CODE WITHOUT IMPLEMENTING PROPER SECURITY MEASURES. THIS IS INTENTIONALLY COMMENTED OUT TO PREVENT ACCIDENTAL USE.

            // return await sql.deleteUser(currentUser.id).then(res => {
            //     if (res.success) {
            //         return { s: 200, j: true, d: { msg: res.message } };
            //     }
            //     else {
            //         return { s: 500, j: true, d: { e: "Internal server error" } };
            //     }
            // }).catch(err => {
            //     if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
            //     return { s: 500, j: true, d: { e: "Internal server error" } };
            // });
            return { s: 501, j: true, d: { e: "Not Implemented yet" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 400, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };

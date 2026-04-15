const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0 && endpoint[0] === "pending") {
        if (method === "GET") {
            if (query.id) {
                const id = parseInt(query.id);
                let approvedOnly = true;
                let pendingOnly = false;
                if (currentUser && !currentUser.e && currentUser.id && currentUser.role) {
                    if (["Admin", "Product Manager"].includes(currentUser.role)) {
                        approvedOnly = false;
                        if (endpoint[0] === "pending") pendingOnly = true;
                        else if (query.approved && query.approved === "true") approvedOnly = true;
                    }
                    else if (endpoint[0] === "pending") return { s: 403, j: true, d: { e: "Forbidden" } };
                }
                else if (endpoint[0] === "pending") return { s: 401, j: true, d: { e: "Unauthorized" } };
                if (isNaN(id)) return { s: 400, j: true, d: { e: "Invalid id query parameter" } };
                return await sql.getComments(id, approvedOnly, pendingOnly).then(result => {
                    if (result.success) {
                        return { s: 200, j: true, d: { comments: result.comments } };
                    }
                    else return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }).catch(err => {
                    console.error("Get comments error:", err);
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else return { s: 400, j: true, d: { e: "Missing ids query parameter" } };
        }
        else if (endpoint[0] === "pending") return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    if (endpoint.length === 0) {
        if (method === "POST") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.rating || !body.data.comment || !body.data.privacy || parseInt(body.data.rating) === NaN || parseInt(body.data.rating) < 1 || parseInt(body.data.rating) > 10) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const comment = body.data.comment.trim();
            if (comment.length === 0) return { s: 400, j: true, d: { e: "Comment cannot be empty" } };
            if (comment.length > 2000) return { s: 400, j: true, d: { e: "Comment cannot be longer than 2000 characters" } };
            const userwords = currentUser.displayname.split(" ").map(s => s.trim()).filter(s => s.length > 0);
            let privacyinvalid = false;
            const userprivacy = body.data.privacy.split("").map(s => {
                if (!["s","h","i"].includes(s)) privacyinvalid = true;
                return privacyinvalid?null:{"s":"SHOW", "h":"HIDE", "i":"INITIAL"}[s];
            })
            if (userprivacy.length === 0) return { s: 400, j: true, d: { e: "Privacy setting is required" } };
            if (userprivacy.length !== userwords.length) return { s: 400, j: true, d: { e: "Privacy setting length must match the number of words in your display name" } };
            if (privacyinvalid) return { s: 400, j: true, d: { e: "Invalid privacy setting" } };
            let nameresult = userwords.map((word, i) => {
                if (userprivacy[i] === "SHOW") return word;
                else if (userprivacy[i] === "INITIAL") {
                    let wordresult = word;
                    while (wordresult[0] === "." && wordresult.length > 1) {
                        wordresult = wordresult.substring(1);
                    }
                    if (wordresult.length === 0) return "";
                    else return word[0] + ".";
                }
                else if (userprivacy[i] === "HIDE") return "";
                else return null;
            });
            nameresult = nameresult.filter(s => s.length > 0).join(" ");
            if (nameresult.length === 0) nameresult = "Anonymous";

            const product = await sql.getProductsByIds(currentUser.id, [body.data.id]).then(result => {
                if (result.success && result.products.length > 0) return result.products[0];
                else return null;
            }).catch(err => {
                console.error("Get product for comment error:", err);
                return null;
            });
            if (!product) return { s: 404, j: true, d: { e: "Product not found" } };
            if (product.can_comment !== true) return { s: 403, j: true, d: { e: "You are unable to comment on this product. Purchase this product to leave a comment. If you have already purchased it, please wait until it is delivered to you." } };

            return await sql.addComment(currentUser.id, body.data.id, comment, parseInt(body.data.rating), nameresult).then(result => {
                if (result.success) return { s: 200, j: true, d: { msg: "Comment added successfully" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }).catch(err => {
                console.error("Add comment error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });

        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not found" } };
}
module.exports = { handleAPI };
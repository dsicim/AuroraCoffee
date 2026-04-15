const sql = require("../../Database/server.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint.length === 0 || endpoint[0] === "pending") {
        if (method === "GET") {
            if (query.id) {
                const id = parseInt(query.id);
                let approvedOnly = true;
                let pendingOnly = false;
                let adminAccess = false;
                if (currentUser && !currentUser.e && currentUser.id) {
                    if (currentUser.role && ["Admin", "Product Manager"].includes(currentUser.role)) {
                        adminAccess = true;
                        approvedOnly = false;
                        if (endpoint[0] === "pending") pendingOnly = true;
                        else if (query.approved && query.approved === "true") approvedOnly = true;
                    }
                    else if (endpoint[0] === "pending") return { s: 403, j: true, d: { e: "Forbidden" } };
                }
                else if (endpoint[0] === "pending") return { s: 401, j: true, d: { e: "Unauthorized" } };
                if (id === "all" && !adminAccess) return { s: 403, j: true, d: { e: "Forbidden" } };
                if (isNaN(id) && id !== "all") return { s: 400, j: true, d: { e: "Invalid id query parameter" } };
                return await sql.getComments(id, approvedOnly, pendingOnly, (currentUser && !currentUser.e && currentUser.id) ? currentUser.id : null).then(result => {
                    if (result.success) {
                        result.comments = result.comments.map(comment => {
                            comment.self = false;
                            if (currentUser && !currentUser.e && currentUser.id && comment.user_id === currentUser.id) comment.self = true;
                            delete comment.product_id;
                            if (!adminAccess) {
                                delete comment.id;
                                delete comment.user_id;
                                delete comment.user_name;
                            }
                            let upcoming = {};
                            let existing = {};
                            if (["pending","rejected"].includes(comment.status)) {
                                upcoming = { name: comment.name_snapshot, text: comment.comment_text, rating: comment.rating, time: comment.created_at, edit: comment.edited_at };
                                existing = null;
                                if (adminAccess || comment.self) upcoming.visible = false;
                            }
                            else if (["approved"].includes(comment.status)) {
                                existing = { name: comment.name_snapshot, text: comment.comment_text, rating: comment.rating, time: comment.created_at, edit: comment.edited_at };
                                upcoming = null;
                                if (adminAccess || comment.self) existing.visible = true;
                            }
                            else if (["pending_edit", "edit_rejected"].includes(comment.status)) {
                                upcoming = { name: comment.edited_name_snapshot, text: comment.edited_text, rating: comment.edited_rating, time: comment.created_at, edit: comment.edited_edited_at };
                                existing = { name: comment.name_snapshot, text: comment.comment_text, rating: comment.rating, time: comment.created_at, edit: comment.edited_at };
                                if (adminAccess || comment.self) {
                                    upcoming.visible = false;
                                    existing.visible = true;
                                }
                            }
                            delete comment.name_snapshot;
                            delete comment.comment_text;
                            delete comment.rating;
                            delete comment.edited_name_snapshot;
                            delete comment.edited_text;
                            delete comment.edited_rating;
                            delete comment.created_at;
                            delete comment.edited_at;
                            delete comment.edited_edited_at;
                            if (approvedOnly && (comment.self && ["pending_edit", "edit_rejected"].includes(comment.status))) return { c: existing, e: upcoming, self: true, visible: true, edit_visible: false, pending: (comment.status === "pending_edit") };
                            else if (approvedOnly && (comment.self && ["pending", "rejected"].includes(comment.status))) return { c: upcoming, self: true, visible: false, edit_visible: false, pending: Boolean(comment.status === "pending") };
                            else if (approvedOnly && comment.self) return { c: existing, self: true, visible: true, edit_visible: true, pending: false };
                            else if (approvedOnly) return { c: existing };
                            else return {...comment, c: existing, e: upcoming };
                        });
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
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.rating || !body.data.comment || !body.data.privacy || String(parseInt(body.data.rating)) === "NaN" || parseInt(body.data.rating) < 1 || parseInt(body.data.rating) > 10) return { s: 400, j: true, d: { e: "Invalid request body" } };
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
                if (result.success) return { s: 200, j: true, d: { msg: result.message } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }).catch(err => {
                console.error("Add comment error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });

        }
        else if (method === "PATCH") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!currentUser.role || !["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.action) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if (!["approve", "reject", "delete"].includes(body.data.action)) return { s: 400, j: true, d: { e: "Invalid action" } };
            return await sql.setCommentStatus(body.data.id, body.data.action === "approve" ? "approved" : body.data.action === "reject" ? "rejected" : "deleted").then(result => {
                if (result.success) return { s: 200, j: true, d: { msg: "Comment status updated successfully" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            }).catch(err => {
                console.error("Set comment status error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not found" } };
}
module.exports = { handleAPI };
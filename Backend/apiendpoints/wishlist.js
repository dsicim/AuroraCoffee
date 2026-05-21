const sql = require("../../Database/server.js");
const currencymodule = require("../components/currency.js");
const mailer = require("../components/email.js");
const fs = require("fs");
async function emailDiscount(config, email, details, type = "discount") {
    const itemstemplate = fs.readFileSync("./emails/discountemailitems.html", "utf-8");
    let itemshtml = "";
    let items = "";
    details.forEach((product,i) => {
        if (items == "") items = product.product_name;
        itemshtml += itemstemplate.replaceAll("{{ITEM_NAME}}", product.product_name)
            .replaceAll("{{ITEM_IMAGE_URL}}", product.product_image)
            .replaceAll("{{ITEM_URL}}", product.product_url)
            .replaceAll("{{ITEM_CATEGORY}}", product.category)
            .replaceAll("{{ITEM_PRICE}}", currencymodule.currencyToSymbol("TRY", product.final_price))
            .replaceAll("{{ITEM_STOCK}}", product.stock)
            .replaceAll("{{BORDERBOTTOM}}", i < details.length - 1 ? 'border-bottom:1px solid #e7eee6;' : '')
            .replaceAll("{{ITEM_DISCOUNT}}", product.discount_rate > 0 ? '<br><span style="text-decoration:line-through;color:#9191c0;font-size:14px;">' + currencymodule.currencyToSymbol("TRY", product.product_price) + '</span><br><span style="font-size:16px;background-color:#efd0a9;color:#21150f;border:1px solid #bf8250;font-weight:bold;padding: 5px;border-radius: 9999px;">' + "-" + product.discount_rate + "%</span>" : '');
    });
    if (type === "stock") {
        itemshtml = itemshtml.replaceAll("#464760", "#4e6046").replaceAll("#252435", "#243524").replaceAll("#464860", "#466046").replaceAll("#252435","#243526").replaceAll("#d8d8e3", "#d9e3d8").replaceAll("#9191c0","#738a6f");
    }
    if (details.length == 2) items += " and one other item";
    else if (details.length > 2) items += " and " + (details.length - 1) + " other items";
    const template = fs.readFileSync("./emails/" + type + "email.html", "utf-8").replaceAll("{{DISCOUNT_ITEMS_HTML}}", itemshtml);
    return await mailer.sendEmail(email, items + " from your wishlist "+(details.length > 1 ? "are" : "is")+" now "+ (type === "discount" ? "on sale!" : "in stock!"), template, []).then(res => {
        //console.log("Email sent:", res);
        return {s: true, res: res};
    }).catch(err => {
        return {s: false, err: err};
    });
}

async function handleAPI(config, method, endpoint, query, body, headers, currentUser, res) {
    if (endpoint.length === 0) {
        if (method === "GET") {
            if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
            return await sql.getWishlists(currentUser.id).then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { wishlist: result.wishlist } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get wishlists error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "POST") {
            if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
            return await sql.addToWishlist(currentUser.id, body.data.id).then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: result.message || "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Add to wishlist error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "DELETE") {
            if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!query || !query.id) return { s: 400, j: true, d: { e: "Product ID is required in query parameters" } };
            return await sql.removeFromWishlist(currentUser.id, query.id).then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: result.message || "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Remove from wishlist error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "users") {
        if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (!["Admin", "Product Manager", "Sales Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
        if (method !== "GET") return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        if (!query || !query.id) return { s: 400, j: true, d: { e: "Product ID is required in query parameters" } };
        return await sql.getUsersWishingForProduct(query.id).then(result => {
            if (result.success) {
                return { s: 200, j: true, d: { users: result.users } };
            }
            else {
                return { s: 400, j: true, d: { e: "An unknown error occurred" } };
            }
        }).catch(err => {
            console.error("Get users wishing for product error:", err);
            if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
            else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
        });
    }
    else if (endpoint[0] === "notifyqueue") {
        if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (!["Admin", "Product Manager", "Sales Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
        if (method === "GET") {
            return await sql.getNotifyQueue().then(result => {
                if (result.success) {
                    return { s: 200, j: true, d: { discount: result.discount, stock: result.stock } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get notify queue error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "notify") {
        if (!currentUser || currentUser.e) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (!["Admin", "Product Manager", "Sales Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
        if (method !== "POST") return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.type || !["discount", "stock"].includes(body.data.type)) return { s: 400, j: true, d: { e: "Invalid request body" } };
        const type = body.data.type;
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
        res.flushHeaders();
        const queue = await sql.getNotifyQueue().then(result => {
            if (result.success) {
                return type === "discount" ? result.discount : result.stock;
            }
        }).catch(err => {
            console.error("Get users wishing for product error:", err);
            if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
            else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
        });
        if (queue === null) {
            res.write("ERROR: " + queue.d.e);
            res.end();
            return { s: 200, j: false, d: null, resended: true };
        }
        const emailqueue = {};
        queue.forEach(q => {
            if (emailqueue[q.user_id]) {
                emailqueue[q.user_id].details.push({
                    product_url: "https://auroracoffee.youcantdrop.com/products/" + q.product_code,
                    product_name: q.product_name,
                    product_image: "https://auroracoffee.youcantdrop.com/uploads/" + q.image_url,
                    category: q.category_name,
                    product_price: q.product_price,
                    final_price: q.final_price,
                    discount_rate: q.discount_rate,
                    currency: "TRY",
                    stock: q.stock
                });
            }
            else {
                emailqueue[q.user_id] = {
                    email: q.username,
                    username: q.displayname,
                    emailblocked: Boolean(q.emailblocked),
                    details: [{
                        product_url: "https://auroracoffee.youcantdrop.com/products/" + q.product_code,
                        product_name: q.product_name,
                        product_image: "https://auroracoffee.youcantdrop.com/uploads/" + q.image_url,
                        category: q.category_name,
                        product_price: q.product_price,
                        final_price: q.final_price,
                        discount_rate: q.discount_rate,
                        currency: "TRY",
                        stock: q.stock
                    }]
                };
            }
        });
        const emailPromises = [];
        Object.keys(emailqueue).forEach(userId => {
            emailqueue[userId].details = emailqueue[userId].details.filter(d => d.stock > 0);
            if (emailqueue[userId].details.length > 0) emailPromises.push({user_id: userId, ...emailqueue[userId]});
        });
        delete emailqueue;
        for (let i = 0; i < emailPromises.length; i++) {
            const emailData = emailPromises[i];
            let setNotify = false;
            if (!emailData.emailblocked) {
                const emailResult = await emailDiscount(config, emailData.email, emailData.details, type).then(r => {
                    if (r.s) {
                        setNotify = true;
                        res.write(`Notification email sent successfully to ${emailData.email} (${i+1} / ${emailPromises.length})\n`);
                    }
                    else {
                        res.write(`Error generating email content for user ${emailData.email}:`, r.err + "\n");
                    }
                }).catch(err => {
                    res.write(`Error generating email content for user ${emailData.email}:`, err + "\n");
                    return;
                });
            }
            else {
                setNotify = true;
                res.write(`User ${emailData.username} (${emailData.email}) has blocked emails, skipping notification for their wishlist items.`);
            }
            await sql.setNotified(emailData.user_id, type, emailData.emailblocked).then(res => {}).catch(err => {
                res.write(`Error setting notified for user ${emailData.username} (${emailData.email}):`, err);
            });
        };
        res.write("Finished sending all emails");
        //res.write(JSON.stringify(emailPromises));
        res.end();

        return { s: 200, j: false, d: null, resended: true };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
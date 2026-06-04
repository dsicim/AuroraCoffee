const fs = require("fs");
const path = require("path");
const sql = require("../../Database/server.js");
const uploader = require("../components/upload.js");

function sanitizeProductForResponse(product) {
    delete product.sales;
    delete product.pick_stock;
    delete product.pick_review_count;
    delete product.pick_cart_count;
    delete product.pick_wishlist_count;
    delete product.pick_delivered_count;
    product.variants = (Array.isArray(product.variants) ? product.variants : []).map(v => {
        if (!v) return v;
        delete v.sales;
        return v;
    });
    if (product.has_variants) {
        product.stock = product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant && variant.stock) || 0), 0);
    }
    return product;
}

async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    const userId = currentUser && !currentUser.e && currentUser.id ? currentUser.id : null;
    const isManager = currentUser && !currentUser.e && ["Admin", "Product Manager", "Sales Manager"].includes(currentUser.role);
    if (endpoint.length === 0) {
        if (method === "GET") {
            if (query.ids || query.urls) {
                const ids = query.ids ? query.ids.split(",").map(x => parseInt(x)).filter(x => !isNaN(x)) : query.urls.split(",").map(x => x.trim()).filter(x => x.length > 0);
                if (ids.length > 0) {
                    return await sql.getProductsByIds(userId, ids, Boolean(query.urls && !query.ids), isManager).then(async result => {
                        if (result.success) {
                            return { s: 200, j: true, d: { products: result.products.map(sanitizeProductForResponse), idsnotfound: result.idsnotfound } };
                        }
                        else {
                            return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                        }
                    }).catch(err => {
                        console.error("Get products by IDs error:", err);
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else return { s: 400, j: true, d: { e: "All IDs are invalid" } };
            }
            else return { s: 400, j: true, d: { e: "Missing ids query parameter" } };
        }
        else if (method === "POST") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data) return { s: 400, j: true, d: { e: "Invalid request body" } };
            return await sql.addProduct(body.data).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message, productId: result.productId } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Add product error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "PATCH") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!isManager) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.edits) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if (currentUser.role === "Sales Manager") {
                const allowedEdits = ["price", "discount_rate"];
                const editKeys = Object.keys(body.data.edits);
                if (editKeys.length === 0 || editKeys.some(key => !allowedEdits.includes(key))) {
                    return { s: 403, j: true, d: { e: "Forbidden: Sales Managers can only edit price and discount_rate" } };
                }
            }
            return await sql.updateProduct(body.data.id, body.data.edits).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get products by IDs error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "DELETE") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            const id = query.id || (body && body.data && body.data.id);
            if (!id) return { s: 400, j: true, d: { e: "Product ID is required" } };
            return await sql.removeProduct(id).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Remove product error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "todays-pick") {
        if (method === "GET") {
            return await sql.getTodaysPick(userId,isManager).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { product: result.product ? sanitizeProductForResponse(result.product) : null, reason: result.reason } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get today pick error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "all") {
        if (method === "GET") {
            return await sql.getAllProducts(userId,isManager).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { products: result.products.map(sanitizeProductForResponse) } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get all products error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "search") {
        if (method === "GET") {
            if (query.q && query.q.trim().length > 0) {
                query.q = query.q.replaceAll("%20", " ").trim();
                return await sql.searchProducts(userId, query.q.trim(), query.s ? (["newest", "oldest", "price_asc", "price_desc", "sales", "rating"].includes(query.s.trim())) ? query.s : "newest" : "newest", isManager).then(async result => {
                    if (result.success) {
                        return { s: 200, j: true, d: { products: result.products.map(sanitizeProductForResponse) } };
                    }
                    else {
                        return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                    }
                }).catch(err => {
                    console.error("Search products error:", err);
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else return { s: 400, j: true, d: { e: "Q query parameter is required" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "categories") {
        if (method === "GET") {
            endpoint.shift();
            const parent = endpoint.length > 0 ? endpoint[0] : null;
            return await sql.getCategories(parent).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { categories: result.categories, products: result.products ? result.products.map(sanitizeProductForResponse) : [] } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get categories error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "POST") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.name) return { s: 400, j: true, d: { e: "Category name is required" } };
            return await sql.addCategory(body.data.name, body.data.parent_id).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message, categoryId: result.categoryId } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Add category error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "PATCH") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Category ID is required" } };
            const name = body.data.name !== undefined ? body.data.name : (body.data.edits ? body.data.edits.name : null);
            const parent_id = body.data.parent_id !== undefined ? body.data.parent_id : (body.data.edits ? body.data.edits.parent_id : null);
            return await sql.updateCategory(body.data.id, name, parent_id).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Update category error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "DELETE") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            const id = query.id || (body && body.data && body.data.id);
            if (!id) return { s: 400, j: true, d: { e: "Category ID is required" } };
            return await sql.deleteCategory(id).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Delete category error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "variants") {
        if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
        if (method === "POST") {
            if (!body || !body.exists || body.err || !body.json || !body.data) return { s: 400, j: true, d: { e: "Invalid request body" } };
            return await sql.addVariant(body.data).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message, variantId: result.variantId } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Add variant error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "PATCH") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Variant ID is required" } };
            const edits = body.data.edits || body.data;
            return await sql.updateVariant(body.data.id, edits).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Update variant error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "DELETE") {
            const id = query.id || (body && body.data && body.data.id);
            if (!id) return { s: 400, j: true, d: { e: "Variant ID is required" } };
            return await sql.deleteVariant(id).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Delete variant error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "options") {
        if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
        if (method === "POST") {
            if (!body || !body.exists || body.err || !body.json || !body.data) return { s: 400, j: true, d: { e: "Invalid request body" } };
            return await sql.addProductOption(body.data).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: result.message, optionGroupId: result.optionGroupId, optionValueId: result.optionValueId } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Add product option error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "discount") {
        if (method === "PATCH") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.rate) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if (!body.data.variant) return await sql.applyDiscount(body.data.id, body.data.rate).then(result => {
                return { s: 200, j: true, d: { msg: result.message } };
            }).catch(err => {
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
                return { s: 500, j: true, d: { e: "Internal server error" } };
            });
            else return await sql.setVariantDiscount(body.data.variant, body.data.rate).then(result => {
                return { s: 200, j: true, d: { msg: result.message } };
            }).catch(err => {
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
                return { s: 500, j: true, d: { e: "Internal server error" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "image") {
        if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
        if (method === "POST") {
            if (!body || !body.raw || !body.exists || !body.upload) return { s: 500, j: true, d: { e: "Internal invalid request body" } };
            const opts = {
                productId: headers["x-product"] ? parseInt(headers["x-product"]) : null,
                isPrimary: Boolean(headers["x-primary"] && (headers["x-primary"] === "1" || headers["x-primary"].toLowerCase() === "true")),
                sortOrder: headers["x-sortorder"] ? parseInt(headers["x-sortorder"]) : 0,
                variantId: headers["x-variant"] ? parseInt(headers["x-variant"]) : null
            }
            if (!opts.productId) return { s: 400, j: true, d: { e: "Product ID header is required" } };
            if (isNaN(opts.productId)) return { s: 400, j: true, d: { e: "Product ID header must be a number" } };
            if (isNaN(opts.sortOrder)) return { s: 400, j: true, d: { e: "Sort order header must be a number" } };
            if (opts.variantId && isNaN(opts.variantId)) return { s: 400, j: true, d: { e: "Variant ID header must be a number" } };
            const product = await sql.getProductsByIds(null, [opts.productId]).then(async result => {
                if (result.success) {
                    const productObj = {};
                    result.products.forEach(p => {
                        productObj[p.id] = p;
                    });
                    if (productObj[opts.productId]) return {s: true, product: productObj[opts.productId] };
                    else return { s: false, e: "Product not found" };
                }
                else {
                    return { s: false, e: "Unknown error checking the product" };
                }
            }).catch(err => {
                console.error("Get products by IDs error:", err);
                if (err instanceof sql.DBError) return { s: false, e: err.error || "Unknown error checking the product" };
                else return { s: false, e: "Unknown error checking the product" };
            });
            if (!product.s) return { s: 400, j: true, d: { e: product.e } };
            if (opts.variantId && !product.product.has_variants) return { s: 400, j: true, d: { e: "Product does not have variants" } };
            if (opts.variantId && !product.product.variants.some(v => v.id === opts.variantId)) return { s: 400, j: true, d: { e: "Variant ID does not belong to this product" } };
            const images = Array.isArray(product.product.images) ? product.product.images : [];
            if (images.length == 0) opts.isPrimary = true; // If there are no images, set this one as primary regardless of the header
            if (images.some(img => img.sort_order === opts.sortOrder)) {
                opts.sortOrder = Math.max(-1, ...images.map(img => Number(img.sort_order) || 0)) + 1;
            }
            const upload = await uploader.createUpload(currentUser, "product" + opts.productId + (opts.variantId ? ("var" + opts.variantId) : ""), { maxSize: 15 * 1024 * 1024, allowedTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp"], convertTo: "webp" }, body.raw, headers).catch(err => {
                console.error("Product image upload error:", err);
                return { s: err?.s || 500, e: err?.e || "Internal server error" };
            });
            if (upload.s !== 200) return { s: upload.s, j: true, d: { e: upload.e } };
            return await sql.addProductImage(opts.productId, upload.url, opts.isPrimary, opts.sortOrder, opts.variantId).then(result => {
                return { s: 200, j: true, d: { msg: result.message, url: result.url, sortOrder: opts.sortOrder, isPrimary: opts.isPrimary, variantId: opts.variantId } };
            }).catch(err => {
                if (upload.path && fs.existsSync(upload.path)) fs.unlinkSync(upload.path);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
                return { s: 500, j: true, d: { e: "Internal server error" } };
            });
        }
        else if (method === "PATCH") {
            if (!body || !body.data || !body.data.id || !body.exists || body.err || !body.json) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if (isNaN(parseInt(body.data.id))) return { s: 400, j: true, d: { e: "Product ID must be a number" } };
            let primaryresult = { s: 204, j: true, d: { e: "No change" } };
            let sortresult = { s: 204, j: true, d: { e: "No change" } };
            if (body.data.setAsPrimary) {
                if (!body.data.url) return { s: 400, j: true, d: { e: "Image URL is required to set primary image" } };
                primaryresult = await sql.setPrimaryImage(body.data.id, body.data.url).then(result => {
                    return { s: 200, j: true, d: { e: result.message } };
                }).catch(err => {
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
                    return { s: 500, j: true, d: { e: "Internal server error" } };
                });
            }
            if (body.data.newOrder !== undefined) {
                sortresult = await (() => {
                    if (!Array.isArray(body.data.newOrder) || body.data.newOrder.some(x => typeof x !== "string")) return { s: 400, j: true, d: { e: "New order must be an array of image URLs" } }
                    if (body.data.newOrder.length === 0) return { s: 400, j: true, d: { e: "New order cannot be empty" } }
                    const idstoorder = {};
                    for (let i = 0; i < body.data.newOrder.length; i++) {
                        if (idstoorder[body.data.newOrder[i]]) return { s: 400, j: true, d: { e: "Duplicate image URLs found in new order" } }
                        idstoorder[body.data.newOrder[i]] = i;
                    }
                    return sql.reorderProductImages(body.data.id, idstoorder).then(result => {
                        return { s: 200, j: true, d: { e: result.message } };
                    }).catch(err => {
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
                        return { s: 500, j: true, d: { e: "Internal server error" } };
                    });
                })();
            }
            if (primaryresult.s === 204 && sortresult.s === 204) return { s: 200, j: true, d: { e: "No change" } };
            else if (primaryresult.s >= 400 && sortresult.s >= 400) return { s: primaryresult.s > sortresult.s ? primaryresult.s : sortresult.s, j: true, d: { setprimary: primaryresult.d.e, setorder: sortresult.d.e } };
            else if (primaryresult.s < 400 && sortresult.s < 400) return { s: 200, j: true, d: { setprimary: primaryresult.d.e, setorder: sortresult.d.e } };
            else return { s: 207, j: true, d: { setprimary: primaryresult.d.e, setorder: sortresult.d.e } };
        }
        else if (method === "DELETE") {
            if (!query.url) return { s: 400, j: true, d: { e: "Image URL is required" } };
            query.url = query.url.trim();
            if (query.url.length === 0) return { s: 400, j: true, d: { e: "Image URL cannot be empty" } };
            if (query.url.includes("/") || query.url.includes("\\") || query.url.includes("..")) return { s: 403, j: true, d: { e: "Invalid image URL" } };
            const result = await sql.removeProductImage(query.url).then(result => {
                return { s: 200, j: true, d: { msg: result.message } };
            }).catch(err => {
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
                return { s: 500, j: true, d: { e: "Internal server error" } };
            });
            if (result.s === 200 && fs.existsSync(path.join(__dirname, "..", "..", "..", "uploads", query.url))) {
                fs.unlinkSync(path.join(__dirname, "..", "..", "..", "uploads", query.url));
            }
            return result;
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };

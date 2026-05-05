const sql = require("../../Database/server.js");
const uploader = require("../components/upload.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    const userId = currentUser && !currentUser.e && currentUser.id ? currentUser.id : null;
    if (endpoint.length === 0) {
        if (method === "GET") {
            if (query.ids || query.urls) {
                const ids = query.ids ? query.ids.split(",").map(x => parseInt(x)).filter(x => !isNaN(x)) : query.urls.split(",").map(x => x.trim()).filter(x => x.length > 0);
                if (ids.length > 0) {
                    return await sql.getProductsByIds(userId, ids, Boolean(query.urls && !query.ids)).then(async result => {
                        if (result.success) {
                            return { s: 200, j: true, d: { products: result.products, idsnotfound: result.idsnotfound } };
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
        else if (method === "PATCH") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.edits) return { s: 400, j: true, d: { e: "Invalid request body" } };
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
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "all") {
        if (method === "GET") {
            return await sql.getAllProducts(userId).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { products: result.products } };
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
                return await sql.searchProducts(userId, query.q.trim(), query.s ? (["newest", "oldest", "price_asc", "price_desc"].includes(query.s.trim())) ? query.s : "newest" : "newest").then(async result => {
                    if (result.success) {
                        return { s: 200, j: true, d: { products: result.products } };
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
        endpoint.shift();
        const parent = endpoint.length > 0 ? endpoint[0] : null;
        if (method === "GET") {
            return await sql.getCategories(parent).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { categories: result.categories, products: result.products } };
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
        if (method === "POST") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!body || !body.raw || !body.exists || !body.upload) return { s: 500, j: true, d: { e: "Internal invalid request body" } };
            const opts = {
                productId: headers["x-product"] ? parseInt(headers["x-product"]) : null,
                isPrimary: headers["x-primary"] === "true",
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
            if (opts.variantId && !product.has_variants) return { s: 400, j: true, d: { e: "Product does not have variants" } };
            if (opts.variantId && !product.variants.some(v => v.id === opts.variantId)) return { s: 400, j: true, d: { e: "Variant ID does not belong to this product" } };
            
            const upload = await uploader.createUpload(currentUser, "product" + opts.productId + (opts.variantId ? ("var" + opts.variantId) : ""), { maxSize: 15 * 1024 * 1024, allowedTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp"], convertTo: "webp" }, body.raw, headers);

            if (upload.s !== 200) return { s: upload.s, j: true, d: { e: upload.e } };
            else return {s: 200, j: true, d: { msg: "Image uploaded successfully", url: upload.url, filetype: upload.filetype } };

            // return await sql.addProductImage(body.data.id, body.data.url, body.data.isPrimary || false, body.data.sortOrder || 0).then(result => {
            //     return { s: 200, j: true, d: { msg: result.message, imageId: result.imageId } };
            // }).catch(err => {
            //     if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
            //     return { s: 500, j: true, d: { e: "Internal server error" } };
            // });
        }
        else if (method === "DELETE") {
            if (!userId) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!["Admin", "Product Manager"].includes(currentUser.role)) return { s: 403, j: true, d: { e: "Forbidden" } };
            if (!query.id) return { s: 400, j: true, d: { e: "Image ID is required" } };
            return await sql.removeProductImage(parseInt(query.id)).then(result => {
                return { s: 200, j: true, d: { msg: result.message } };
            }).catch(err => {
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
                return { s: 500, j: true, d: { e: "Internal server error" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
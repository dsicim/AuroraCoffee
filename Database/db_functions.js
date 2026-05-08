const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

// Load config from the Backend directory relative to this file
// Original server.js used "../Backend/config.json"
const configPath = path.join(__dirname, '../Backend/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

class DBError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.error = message;
    }
}

let pool;
const func = {};

func.initDB = async function () {
    try {
        pool = mysql.createPool({
            host: "localhost",
            port: config.dbport,
            user: config.user,
            password: config.password,
            database: config.database,
            multipleStatements: true
        });
        console.log('Connected to MySQL database.');
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
}

func.registerUser = async function (username, password, displayname) {
    if (!username || !password || !displayname) {
        throw new DBError(400, 'Username, name and password are required');
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (displayname, username, password, verified, role, nameprivacy) VALUES (?, ?, ?, ?, ?, ?)',
            [displayname, username, hashedPassword, !config.verifyemail, 'Customer', displayname.split(" ").map(n => "s").join(" ")]
        );
        return { success: true, message: 'User registered successfully', userId: result.insertId };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new DBError(403, 'Username already exists');
        }
        else {
            console.error('Registration error:', error);
            throw new DBError(500, 'Internal server error');
        }
    }
};

func.loginUser = async function (username, password) {
    if (!username || !password) {
        throw new DBError(400, 'Username and password are required');
    }

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            throw new DBError(401, 'Invalid email or password');
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            throw new DBError(401, 'Invalid email or password');
        }
        if (config.verifyemail && !user.verified) {
            return { success: false, message: 'User unverified', userId: user.id };
        }
        return { success: true, message: 'Login successful', userId: user.id };
    } catch (error) {
        if (error instanceof DBError) throw error; // Re-throw known DBErrors
        console.error('Login error:', error);
        throw new DBError(500, 'Internal server error');
    }
};

func.editUser = async function (userId, newDisplayName, newNamePrivacy) {
    if (!userId || !newDisplayName || !newNamePrivacy) {
        throw new DBError(400, 'User ID, display name, and name privacy are required');
    }
    try {
        const [result] = await pool.execute(
            'UPDATE users SET displayname = ?, nameprivacy = ? WHERE id = ?',
            [newDisplayName, newNamePrivacy, userId]
        );
        if (result.affectedRows === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, message: 'User updated successfully' };
    } catch (error) {
        if (error instanceof DBError) throw error; // Re-throw known DBErrors
        console.error('User update error:', error);
        throw new DBError(500, 'Internal server error');
    }
}

func.verifyUser = async function (userId) {
    if (!userId) {
        throw new DBError(400, 'User ID is required');
    }
    try {
        const [result] = await pool.execute(
            'UPDATE users SET verified = ? WHERE id = ?',
            [true, userId]
        );
        if (result.affectedRows === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, message: 'Email verified successfully' };
    } catch (error) {
        if (error instanceof DBError) throw error; // Re-throw known DBErrors
        console.error('Email verification error:', error);
        throw new DBError(500, 'Internal server error');
    }
}

func.findUser = async function (username, id) {
    if (!username) {
        throw new DBError(400, 'Username is required');
    }
    try {
        const [rows] = await pool.execute(
            'SELECT id, displayname, username, verified, role, nameprivacy, created_at FROM users WHERE ' + (id ? 'id = ?' : 'username = ?'),
            [username]
        );
        if (rows.length === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, user: rows[0] };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Find user error:', error);
        throw new DBError(500, 'Internal server error');
    }
};

func.changePassword = async function (username, newPassword) {
    if (!username || !newPassword) {
        throw new DBError(400, 'Username and new password are required');
    }
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        if (rows.length === 0) {
            throw new DBError(404, 'User not found');
        }
        const user = rows[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, user.id]
        );
        return { success: true, message: 'Password changed successfully' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Change password error:', error);
        throw new DBError(500, 'Internal server error');
    }
};

func.runCode = async function (code) {
    try {
        const result = await pool.query(code);
        return { success: true, message: 'Code executed successfully', result: result };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Code execution error:', error);
        throw new DBError(500, 'Code execution failed: ' + error.message);
    }
}

func.resetDB = async function () {
    // Placeholder for reset logic
}

// --- Product Management Functions ---

// func.getBrewMethods = async function() { -- This function is no longer needed as brew methods are fetched within enrichProductsWithOptions --
//     try {
//         const [rows] = await pool.execute('SELECT * FROM brew_methods');
//         return { success: true, brew_methods: rows };
//     } catch (error) {
//         console.error('Get brew methods error:', error);
//         throw new DBError(500, 'Failed to fetch brew methods');
//     }
// };

func.enrichProductsWithOptions = async function (userId, products) {
    if (!products || products.length === 0) return products;
    const productIds = products.map(p => p.id);

    if (userId) {
        const [delivereds] = await pool.query(`SELECT * FROM delivered_items WHERE user_id = ? AND product_id IN (?)`, [userId, productIds]);
        for (const item of delivereds) {
            products.find(p => p.id === item.product_id).can_comment = true;
        }
    }

    // Fetch options
    const [options] = await pool.query(`
        SELECT pog.id as group_id, pog.product_id, pog.name as group_name, pog.group_code as group_code, pog.cumulative_stock, pog.separate_stock, pog.separate_price, pog.is_required, pog.multi_select, pog.priority,
               pov.id as value_id, pov.label, pov.value_code, pov.description, pov.price_add, pov.price_mult, pov.sort_order
        FROM product_option_groups pog
        LEFT JOIN product_option_values pov ON pog.id = pov.product_option_group_id
        WHERE pog.product_id IN (?)
        ORDER BY pog.priority, pov.sort_order
    `, [productIds]);

    // Fetch variants
    const [variants] = await pool.query(`
        SELECT pv.id as variant_id, pv.product_id, pv.variant_code, pv.price_add, pv.price_mult, pv.stock, pv.discount_rate,
               pvv.product_option_value_id
        FROM product_variants pv
        LEFT JOIN product_variant_values pvv ON pv.id = pvv.product_variant_id
        WHERE pv.product_id IN (?)
    `, [productIds]);

    // Fetch images
    const [images] = await pool.query(`
        SELECT * FROM product_images WHERE product_id IN (?) ORDER BY sort_order ASC
    `, [productIds]);

    // Map to products
    let brewMethods = null;
    for (let p of products) {
        const originalPrice = parseFloat(p.price);
        if (p.averageRating) p.averageRating = parseFloat(p.averageRating);
        p.options = [];
        if (p.parent_category_name == "Coffee") {
            if (!brewMethods) {
                const [bm] = await pool.execute('SELECT * FROM brew_methods');
                brewMethods = bm;
            }
            const groups = {
                "BM": {
                    id: "BM",
                    name: "Brewing Method",
                    group_code: "brew_method",
                    store_as_variant: false,
                    cumulative_stock: false,
                    seperate_stock: false,
                    seperate_price: false,
                    is_required: true,
                    multi_select: false,
                    priority: 0,
                    values: []
                }
            };
            for (const method of brewMethods) {
                groups.BM.values.push({
                    id: method.id,
                    label: method.name,
                    desc: method.description,
                    value_code: method.id.toString(),
                    price_add: 0,
                    price_mult: 1,
                    sort_order: method.id
                });
            }
            p.options = Object.values(groups);
        }
        // Map images
        p.images = images.filter(img => img.product_id === p.id).map(img => ({
            id: img.id,
            url: img.image_url,
            is_primary: !!img.is_primary,
            variant_id: img.variant_id,
            sort_order: img.sort_order
        }));
        if (!p.has_variants) {
            p.variants = [];
            continue;
        }

        const pOptions = options.filter(o => o.product_id === p.id);
        const groups = {};
        for (const opt of pOptions) {
            if (!groups[opt.group_id]) {
                groups[opt.group_id] = {
                    id: opt.group_id,
                    name: opt.group_name,
                    group_code: opt.group_code,
                    store_as_variant: true,
                    cumulative_stock: !!opt.cumulative_stock,
                    separate_stock: !!opt.separate_stock,
                    separate_price: !!opt.separate_price,
                    is_required: !!opt.is_required,
                    multi_select: !!opt.multi_select,
                    priority: opt.priority,
                    values: []
                };
            }
            if (opt.value_id) {
                groups[opt.group_id].values.push({
                    id: opt.value_id,
                    label: opt.label,
                    desc: opt.description || null,
                    value_code: opt.value_code,
                    price_add: parseFloat(opt.price_add),
                    price_mult: parseFloat(opt.price_mult),
                    sort_order: opt.sort_order
                });
            }
        }
        p.options.push(...Object.values(groups));

        const pVariants = {};
        for (const v of variants.filter(v => v.product_id === p.id)) {
            if (!pVariants[v.variant_id]) {
                let op = {};
                try {
                    op = JSON.parse(Buffer.from(v.variant_code, 'base64').toString('utf-8'));
                } catch (error) { };
                const vBasePrice = (originalPrice + parseFloat(v.price_add)) * parseFloat(v.price_mult);
                const vDiscountRate = parseFloat(v.discount_rate || 0);
                pVariants[v.variant_id] = {
                    id: v.variant_id,
                    variant_code: v.variant_code,
                    price: vBasePrice,
                    discount_rate: vDiscountRate,
                    discounted_price: vDiscountRate > 0 ? vBasePrice * (1 - vDiscountRate / 100) : vBasePrice,
                    stock: v.stock,
                    option_value_codes: op
                };
            }
        }
        p.variants = Object.values(pVariants);

        // Product level discount
        const pDiscountRate = parseFloat(p.discount_rate || 0);
        p.discount_rate = pDiscountRate;
        p.discounted_price = pDiscountRate > 0 ? originalPrice * (1 - pDiscountRate / 100) : originalPrice;
    }
    return products;
};
func.getAllProducts = async function (userId) {
    try {
        let [rows] = await pool.execute(`
            SELECT p.*, c.name AS category_name, pc.name AS parent_category_name, r.averageRating AS averageRating
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            LEFT JOIN (
                SELECT product_id, ROUND(AVG(rating) / 2, 2) AS averageRating
                FROM comments
                WHERE rating IS NOT NULL
                GROUP BY product_id
            ) r ON r.product_id = p.id
        `);
        rows = await func.enrichProductsWithOptions(userId, rows);
        return { success: true, products: rows };
    } catch (error) {
        console.error('Get all products error:', error);
        throw new DBError(500, 'Failed to fetch products: ' + error.message);
    }
};
func.getAllImageURLs = async function () {
    try {
        let [rows] = await pool.execute(`
            SELECT image_url
            FROM product_images
        `);
        return { success: true, image_urls: rows.map(r => r.image_url) };
    } catch (error) {
        console.error('Get all image URLs error:', error);
        throw new DBError(500, 'Failed to fetch image URLs: ' + error.message);
    }
};
func.getProductsByIds = async function (userId, productId, isUrl = false) {
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    try {
        productId = Array.isArray(productId) ? productId : [productId];
        let [rows] = await pool.query(`
            SELECT p.*, c.name AS category_name, pc.name AS parent_category_name, r.averageRating AS averageRating
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            LEFT JOIN (
                SELECT product_id, ROUND(AVG(rating) / 2, 2) AS averageRating
                FROM comments
                WHERE rating IS NOT NULL
                GROUP BY product_id
            ) r ON r.product_id = p.id
            WHERE p.${isUrl ? 'product_code' : 'id'} IN (?)
        `, [productId]);
        if (rows.length === 0) {
            throw new DBError(404, 'No products found');
        }
        rows = await func.enrichProductsWithOptions(userId, rows);
        const foundIds = rows.map(r => r["" + (isUrl ? 'product_code' : 'id')]);
        const missingIds = productId.filter(id => !foundIds.includes(id));
        return { success: true, products: rows, idsnotfound: missingIds };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Get products by IDs error:', error);
        throw new DBError(500, 'Failed to fetch products: ' + error.message);
    }
};

func.searchProducts = async function (userId, query, sortBy = 'newest') {
    try {
        let sql = `
            SELECT p.*, c.name AS category_name, pc.name AS parent_category_name, r.averageRating AS averageRating
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            LEFT JOIN (
                SELECT product_id, ROUND(AVG(rating) / 2, 2) AS averageRating
                FROM comments
                WHERE rating IS NOT NULL
                GROUP BY product_id
            ) r ON r.product_id = p.id
            WHERE p.name LIKE ? OR p.description LIKE ?
        `;
        const params = [`%${query}%`, `%${query}%` || ''];

        switch (sortBy) {
            case 'price_asc':
                sql += ' ORDER BY p.price ASC';
                break;
            case 'price_desc':
                sql += ' ORDER BY p.price DESC';
                break;
            case 'sales':
                sql += ' ORDER BY p.sales DESC';
                break;
            case 'rating':
                sql += ' ORDER BY averageRating DESC';
                break;
            case 'oldest':
                sql += ' ORDER BY p.created_at ASC';
                break;
            case 'newest':
            default:
                sql += ' ORDER BY p.created_at DESC';
                break;
        }

        let [rows] = await pool.execute(sql, params);
        rows = await func.enrichProductsWithOptions(userId, rows);
        return { success: true, products: rows };
    } catch (error) {
        console.error('Search products error:', error);
        throw new DBError(500, 'Failed to search products');
    }
};

func.getCategories = async function (parent) {

};

func.decreaseStock = async function (productId, qty, variantId = null) {
    if (!productId || qty === undefined) {
        throw new DBError(400, 'Product ID and quantity are required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute('SELECT stock FROM products WHERE id = ? FOR UPDATE', [productId]);
        if (rows.length === 0) {
            throw new DBError(404, 'Product not found');
        }
        const currentStock = rows[0].stock;
        if (currentStock < qty) {
            throw new DBError(400, 'Insufficient total product stock');
        }
        await connection.execute('UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?', [qty, qty, productId]);

        if (variantId) {
            const [vRows] = await connection.execute('SELECT stock FROM product_variants WHERE id = ? AND product_id = ? FOR UPDATE', [variantId, productId]);
            if (vRows.length === 0) {
                throw new DBError(404, 'Variant not found');
            }
            if (vRows[0].stock < qty) {
                throw new DBError(400, 'Insufficient variant stock');
            }
            await connection.execute('UPDATE product_variants SET stock = stock - ?, sales = sales + ? WHERE id = ?', [qty, qty, variantId]);
        }

        await connection.commit();
        return { success: true, message: 'Stock decreased successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Decrease stock error:', error);
        throw new DBError(500, 'Failed to decrease stock');
    } finally {
        connection.release();
    }
};

func.increaseStock = async function (productId, qty) {
    if (!productId || qty === undefined) {
        throw new DBError(400, 'Product ID and quantity are required');
    }
    try {
        const [result] = await pool.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, productId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        return { success: true, message: 'Stock increased successfully' };
    } catch (error) {
        console.error('Increase stock error:', error);
        throw new DBError(500, 'Failed to increase stock');
    }
};

func.addProduct = async function (data) {
    const { name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes, material, capacity, image_url, discount_rate } = data;
    if (!name || price === undefined) {
        throw new DBError(400, 'Name and price are required');
    }
    try {
        const [result] = await pool.execute(`
            INSERT INTO products (
                name, description, price, stock, category_id, origin, roast_level, acidity, flavor_notes, material, capacity, image_url, discount_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name, description || null, price, stock || 0, category_id || null,
            origin || null, roast_level || null, acidity || null, flavor_notes || null,
            material || null, capacity || null, image_url || null, discount_rate || 0
        ]);
        return { success: true, message: 'Product added successfully', productId: result.insertId };
    } catch (error) {
        console.error('Add product error:', error);
        throw new DBError(500, 'Failed to add product');
    }
};

func.updateProduct = async function (productId, data) {
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    try {
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);
        values.push(productId);

        const [result] = await pool.execute(`UPDATE products SET ${fields} WHERE id = ?`, values);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        return { success: true, message: 'Product updated successfully' };
    } catch (error) {
        console.error('Update product error:', error);
        throw new DBError(500, 'Failed to update product');
    }
};

func.removeProduct = async function (productId) {
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    try {
        const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [productId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        return { success: true, message: 'Product removed successfully' };
    } catch (error) {
        console.error('Remove product error:', error);
        throw new DBError(500, 'Failed to remove product');
    }
};

func.setProductPrice = async function (productId, price) {
    if (!productId || price === undefined) {
        throw new DBError(400, 'Product ID and price are required');
    }
    try {
        const [result] = await pool.execute('UPDATE products SET price = ? WHERE id = ?', [price, productId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        return { success: true, message: 'Price updated successfully' };
    } catch (error) {
        console.error('Set price error:', error);
        throw new DBError(500, 'Failed to set price');
    }
};

func.applyDiscount = async function (productId, rate) {
    if (!productId || rate === undefined) {
        throw new DBError(400, 'Product ID and discount rate are required');
    }
    try {
        const [result] = await pool.execute('UPDATE products SET discount_rate = ? WHERE id = ?', [rate, productId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        return { success: true, message: 'Discount applied successfully' };
    } catch (error) {
        console.error('Apply discount error:', error);
        throw new DBError(500, 'Failed to apply discount');
    }
};

func.setVariantDiscount = async function (variantId, rate) {
    if (!variantId || rate === undefined) {
        throw new DBError(400, 'Variant ID and discount rate are required');
    }
    try {
        const [result] = await pool.execute('UPDATE product_variants SET discount_rate = ? WHERE id = ?', [rate, variantId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Variant not found');
        }
        return { success: true, message: 'Variant discount applied successfully' };
    } catch (error) {
        console.error('Apply variant discount error:', error);
        throw new DBError(500, 'Failed to apply variant discount');
    }
};

func.addProductImage = async function (productId, imageUrl, isPrimary = false, sortOrder = 0, variantId = null) {
    if (!productId || !imageUrl) {
        throw new DBError(400, 'Product ID and Image URL are required');
    }
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        if (isPrimary) {
            await connection.execute(
                'UPDATE product_images SET is_primary = 0 WHERE product_id = ? AND is_primary = 1',
                [productId]
            );
        }
        const [result] = await connection.execute(
            'INSERT INTO product_images (product_id, image_url, is_primary, sort_order, variant_id) VALUES (?, ?, ?, ?, ?)',
            [productId, imageUrl, isPrimary, sortOrder, variantId]
        );
        await connection.commit();
        return { success: true, message: 'Image added successfully', imageId: result.insertId, url: imageUrl };
    } catch (error) {
        console.error('Add product image error:', error);
        throw new DBError(500, 'Failed to add product image');
    }
};

func.setImageOrder = async function (imageUrl, newSortOrder) {
    if (!imageUrl || newSortOrder === undefined) {
        throw new DBError(400, 'Image URL and new sort order are required');
    }
    if (!Array.isArray(newSortOrder)) {
        throw new DBError(400, 'New sort order must be an array of image URLs in the desired order');
    }
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        for (let i = 0; i < newSortOrder.length; i++) {
            const url = newSortOrder[i];
            const [result] = await connection.execute('UPDATE product_images SET sort_order = ? WHERE image_url = ?', [i, url]);
            if (result.affectedRows === 0) {
                await connection.rollback();
                throw new DBError(404, `Image with URL ${url} not found`);
            }
        }
        await connection.commit();
        return { success: true, message: 'Image order updated successfully' };
    } catch (error) {
        console.error('Set image order error:', error);
        throw new DBError(500, 'Failed to set image order');
    }
}

func.setPrimaryImage = async function (productId, imageUrl) {
    if (!imageUrl) {
        throw new DBError(400, 'Image URL is required');
    }
    try {
        const [result] = await pool.execute(
            'UPDATE product_images SET is_primary = 0 WHERE product_id = ? AND is_primary = 1',
            [productId]
        );
        const [result2] = await pool.execute(
            'UPDATE product_images SET is_primary = 1 WHERE product_id = ? AND image_url = ?',
            [productId, imageUrl]
        );
        if (result2.affectedRows === 0) {
            throw new DBError(404, 'Image or product not found');
        }
        return { success: true, message: 'Primary image set successfully' };
    } catch (error) {
        console.error('Set primary image error:', error);
        throw new DBError(500, 'Failed to set primary image');
    }
};

func.removeProductImage = async function (imageUrl) {
    if (!imageUrl) {
        throw new DBError(400, 'Image URL is required');
    }
    try {
        const [result] = await pool.execute('DELETE FROM product_images WHERE image_url = ?', [imageUrl]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Image not found');
        }
        return { success: true, message: 'Image removed successfully' };
    } catch (error) {
        console.error('Remove product image error:', error);
        throw new DBError(500, 'Failed to remove product image');
    }
};

func.deleteUser = async function (userId) {
    if (!userId) {
        throw new DBError(400, 'User ID is required');
    }
    try {
        // Tokens are invalidated in the API layer before calling this, but we can also do it here if needed.
        // Most tables have ON DELETE CASCADE.
        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, message: 'Account deleted successfully' };
    } catch (error) {
        console.error('Delete user error:', error);
        throw new DBError(500, 'Failed to delete user account');
    }
};

// --- User Role Management ---

func.changeUserRole = async function (userId, newRole) {
    if (!userId || !newRole) {
        throw new DBError(400, 'User ID and new role are required');
    }
    try {
        const [result] = await pool.execute('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, message: 'User role updated successfully' };
    } catch (error) {
        console.error('Change user role error:', error);
        throw new DBError(500, 'Failed to update user role');
    }
};

func.getUserRole = async function (userId) {
    if (!userId) {
        throw new DBError(400, 'User ID is required');
    }
    try {
        const [rows] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, role: rows[0].role };
    } catch (error) {
        console.error('Get user role error:', error);
        throw new DBError(500, 'Failed to fetch user role');
    }
};

// --- User Card Storage Management ---

func.setUserCards = async function (userId, newCardToken) {
    if (!userId || !newCardToken) {
        throw new DBError(400, 'User ID and new card token are required');
    }
    try {
        const [result] = await pool.execute('UPDATE users SET cctoken = ? WHERE id = ?', [newCardToken, userId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, message: 'User card token updated successfully' };
    } catch (error) {
        console.error('Set user cards error:', error);
        throw new DBError(500, 'Failed to update user card token');
    }
};

func.getUserCards = async function (userId) {
    if (!userId) {
        throw new DBError(400, 'User ID is required');
    }
    try {
        const [rows] = await pool.execute('SELECT cctoken FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            throw new DBError(404, 'User not found');
        }
        return { success: true, cardTokens: rows[0].cctoken };
    } catch (error) {
        console.error('Get user cards error:', error);
        throw new DBError(500, 'Failed to fetch user card tokens');
    }
};

// --- Comment & Rating Functions ---

func.addComment = async function (userId, productId, text, rating, namesnapshot) {
    if (!userId || !productId || (!text && rating === null)) {
        throw new DBError(400, 'User ID, Product ID and (text or rating) are required');
    }
    try {
        // Check if user has already commented on the product
        const commented = await func.hasUserAlreadyCommented(userId, productId);
        if (commented === false) {
            if (!text) text = "";
            const [result] = await pool.execute(
                'INSERT INTO comments (user_id, product_id, comment_text, rating, status, name_snapshot) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, productId, text, rating, 'pending', namesnapshot]
            );
            return { success: true, message: 'Comment submitted successfully'+(text===""?'':', awaiting approval'), commentId: result.insertId };
        }
        else if (["rejected", "pending"].includes(commented.status)) {
            const [result] = await pool.execute(
                'UPDATE comments SET comment_text = ?, rating = ?, status = ?, name_snapshot = ?, created_at = CURRENT_TIMESTAMP, edited_at = CURRENT_TIMESTAMP, edited_edited_at = CURRENT_TIMESTAMP WHERE id = ?',
                [text, rating, 'pending', namesnapshot, commented.id]
            );
            if (result.affectedRows === 0) {
                throw new DBError(404, 'Comment not found');
            }
            return { success: true, message: 'Comment edit submitted successfully'+(text===""?'':', your comment is now awaiting approval.'), commentId: result.insertId };
        }
        else {
            if (!text) text = "";
            const bypassApproval = commented.status === "approved" && (text === commented.comment_text || text === "") && (namesnapshot === commented.name_snapshot || namesnapshot === "Anonymous");
            if (text === "") commented.comment_text = "";
            const [result] = await pool.execute(
                'UPDATE comments SET comment_text = ?, edited_text = ?, rating = ?, status = ?, edited_name_snapshot = ?, edited_edited_at = CURRENT_TIMESTAMP WHERE id = ?',
                [commented.comment_text, text, rating, bypassApproval ? 'approved' : 'pending_edit', namesnapshot, commented.id]
            );
            if (result.affectedRows === 0) {
                throw new DBError(404, 'Comment not found');
            }
            return { success: true, message: 'Comment edit submitted successfully'+(text===""?'':', the edit is now awaiting approval. Your previous comment will still be visible until your new comment is approved.'), commentId: result.insertId };
        }
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Add comment error:', error);
        throw new DBError(500, 'Failed to add comment');
    }
};

func.deleteComment = async function (userId, productId) {
    if (!userId || !productId) throw new DBError(400, 'User ID and Product ID are required');
    try {
        const [result] = await pool.execute('DELETE FROM comments WHERE product_id = ? AND user_id = ?', [productId, userId]);
        if (result.affectedRows === 0) throw new DBError(404, 'Comment not found');
        return { success: true, message: 'Comment removed' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Delete comment error:', error);
        throw new DBError(500, 'Failed to delete comment');
    }
}

func.setCommentStatus = async function (commentId, status) {
    if (!commentId || !status) {
        throw new DBError(400, 'Comment ID and status are required');
    }
    try {
        const [rows] = await pool.execute('SELECT * FROM comments WHERE id = ?', [commentId]);
        if (rows.length === 0) {
            throw new DBError(404, 'Comment not found');
        }
        const comment = rows[0];
        const currentStatus = comment.status;
        if (status === "rejected" && currentStatus === "pending_edit") status = "edit_rejected";
        if (status === 'approved' && ['pending_edit', 'edit_rejected'].includes(currentStatus)) {
            const [result] = await pool.execute('UPDATE comments SET status = ?, edited_at = edited_edited_at, comment_text = edited_text, rating = edited_rating, name_snapshot = edited_name_snapshot, edited_edited_at = NULL, edited_text = NULL, edited_rating = NULL, edited_name_snapshot = NULL WHERE id = ?', [status, commentId]);
            if (result.affectedRows === 0) {
                throw new DBError(404, 'Comment not found');
            }
            return { success: true, message: 'Comment status updated successfully. Existing comment has been replaced. Old comment has been removed.' };
        }
        else {
            const [result] = await pool.execute('UPDATE comments SET status = ? WHERE id = ?', [status, commentId]);
            if (result.affectedRows === 0) {
                throw new DBError(404, 'Comment not found');
            }
            return { success: true, message: 'Comment status updated successfully' };
        }
    } catch (error) {
        console.error('Update comment error:', error);
        if (error instanceof DBError) throw error;
        throw new DBError(500, 'Failed to update comment');
    }
};

func.getComments = async function (productId, approvedOnly = true, pendingOnly = false, rejectedOnly = false, meOnly = false, userId = null) {
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    try {
        const params = [];
        let where = productId === "all" ? '1' : `c.product_id = ?`;
        if (productId !== "all") params.push(productId);
        if (meOnly) {
            where += ` AND c.user_id = ?`;
            params.push(userId);
        } else if (approvedOnly) {
            where += ` AND (c.status IN ('approved', 'pending_edit', 'edit_rejected')${userId ? ` OR c.user_id = ?` : ``})`;
            if (userId) params.push(userId);
        } else if (pendingOnly) {
            where += ` AND (c.status IN ('pending', 'pending_edit')${userId ? ` OR c.user_id = ?` : ``})`;
            if (userId) params.push(userId);
        } else if (rejectedOnly) {
            where += ` AND (c.status IN ('rejected', 'edit_rejected')${userId ? ` OR c.user_id = ?` : ``})`;
            if (userId) params.push(userId);
        }
        const [rows] = await pool.execute(`
            SELECT c.*, u.displayname as user_name
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE ${where}
            ORDER BY c.created_at DESC
        `, params);
        return { success: true, comments: rows };
    } catch (error) {
        console.error('Get comments error:', error);
        throw new DBError(500, 'Failed to fetch comments');
    }
};

func.getAverageRating = async function (productId) {
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    try {
        const [rows] = await pool.execute('SELECT AVG(rating) as averageRating FROM comments WHERE product_id = ? AND rating IS NOT NULL', [productId]);
        const average = rows[0].averageRating;
        if (average === null) {
            return { success: true, averageRating: 0 };
        }
        return { success: true, averageRating: parseFloat(Number(average).toFixed(1)) };
    } catch (error) {
        console.error('Get average rating error:', error);
        throw new DBError(500, 'Failed to calculate average rating');
    }
}

// --- Ordering Functions ---
func.reserveOrderNumber = async function (userId, details) {
    if (!userId || !details) {
        throw new DBError(400, 'User ID and details are required');
    }
    let orderId = null;
    try {
        while (!orderId) {
            const random = crypto.randomBytes(20).toString("base64").replaceAll("+", "").replaceAll("/", "").toUpperCase().substring(0, 20);
            try {
                const [result] = await pool.execute('INSERT INTO orders (id, user_id, details) VALUES (?, ?, ?)', [random, userId, details]);
                if (result.affectedRows !== 0) orderId = random;
            }
            catch (error) {
                if (error.code !== 'ER_DUP_ENTRY') {
                    console.error('Reserve order number error:', error);
                    throw new DBError(500, 'Failed to reserve order number');
                }
            }
        }
        return { success: true, oID: orderId };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Reserve order number error:', error);
        throw new DBError(500, 'Failed to check existing order');
    }
};
func.createOrder = async function (userId, items) {
    if (!userId || !items || !items.length) {
        throw new DBError(400, 'User ID and items are required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Calculate total price
        let totalPrice = 0;
        for (const item of items) {
            totalPrice += item.price * item.quantity;
        }

        // 1. Create Order
        const [orderResult] = await connection.execute(
            'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, ?)',
            [userId, totalPrice, 'pending']
        );
        const orderId = orderResult.insertId;

        // 2. Create Order Items and Decrease Stock
        for (const item of items) {
            await connection.execute(
                'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
                [orderId, item.productId, item.quantity, item.price]
            );

            // Decrease stock
            const [stockResult] = await connection.execute('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity, item.productId, item.quantity]);
            if (stockResult.affectedRows === 0) {
                throw new Error(`Insufficient stock for product ID ${item.productId}`);
            }
        }

        await connection.commit();
        return { success: true, message: 'Order created successfully', orderId: orderId };
    } catch (error) {
        await connection.rollback();
        console.error('Create order error:', error);
        throw new DBError(500, 'Failed to create order');
    } finally {
        connection.release();
    }
};

func.updateOrderStatus = async function (orderId, status, paymentId = null) {
    if (!orderId || !status) {
        throw new DBError(400, 'Order ID and status are required');
    }
    try {
        const [result] = paymentId ? await pool.execute('UPDATE orders SET status = ?, purchaseId = ? WHERE id = ?', [status, paymentId, orderId]) : await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Order not found');
        }
        return { success: true, message: 'Order status updated successfully' };
    } catch (error) {
        console.error('Update order status error:', error);
        throw new DBError(500, 'Failed to update order status');
    }
};
func.getOrderByPayment = async function (orderId, paymentId) {
    if (!orderId || !paymentId) {
        throw new DBError(400, 'Order ID and payment ID are required');
    }
    try {
        const [orders] = await pool.execute('SELECT id FROM orders WHERE id = ? AND purchaseId = ?', [orderId, paymentId]);
        if (orders.length === 0) {
            throw new DBError(404, 'Order not found');
        }
        return { success: true, order: orders[0].id, userId: orders[0].user_id };
    } catch (error) {
        console.error('Get user orders error:', error);
        throw new DBError(500, 'Failed to fetch user orders');
    }
};
func.getOrder = async function (orderId) {
    if (!orderId) {
        throw new DBError(400, 'Order ID is required');
    }
    try {
        const [orders] = await pool.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) {
            throw new DBError(404, 'Order not found');
        }
        return { success: true, order: orders[0] };
    } catch (error) {
        console.error('Get order error:', error);
        throw new DBError(500, 'Failed to fetch order');
    }
};
func.addDeliveredItems = async function (userId, products) {
    if (!userId || !products || !products.length) {
        throw new DBError(400, 'User ID and products are required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const p of products) {
            await pool.execute('INSERT IGNORE INTO delivered_items (user_id, product_id) VALUES (?, ?)', [userId, p.product_id]);
        }
        await connection.commit();
        return { success: true, message: 'Delivered items recorded successfully' };
    }
    catch (error) {
        console.error('Add delivered items error:', error);
        throw new DBError(500, 'Failed to add delivered items');
    } finally {
        connection.release();
    }
};
func.getDeliveredItems = async function (userId) {
    if (!userId) {
        throw new DBError(400, 'User ID is required');
    }
    try {
        const [items] = await pool.execute('SELECT * FROM delivered_items WHERE user_id = ?', [userId]);
        return { success: true, items: items };
    } catch (error) {
        console.error('Get delivered items error:', error);
        throw new DBError(500, 'Failed to fetch delivered items');
    }
}
func.getAllOrders = async function (orderId = null) {
    try {
        const [orders] = await pool.execute('SELECT o.*, u.displayname AS customer_name, u.username AS customer_email FROM orders o LEFT JOIN users u ON o.user_id = u.id' + (orderId ? ' WHERE o.id = ?' : ' ')+' ORDER BY o.created_at DESC', orderId ? [orderId] : []);
        return { success: true, orders: orders };
    } catch (error) {
        console.error('Get user orders error:', error);
        throw new DBError(500, 'Failed to fetch user orders');
    }
};
func.getUserOrders = async function (userId, orderId = null) {
    if (!userId) {
        throw new DBError(400, 'User ID is required');
    }
    try {
        const [orders] = await pool.execute('SELECT * FROM orders WHERE user_id = ?' + (orderId ? ' AND id = ?' : ' ORDER BY created_at DESC'), orderId ? [userId, orderId] : [userId]);
        return { success: true, orders: orders };
    } catch (error) {
        console.error('Get user orders error:', error);
        throw new DBError(500, 'Failed to fetch user orders');
    }
};

func.getOrderHistory = func.getUserOrders;

func.cancelOrder = async function (orderId) {
    if (!orderId) {
        throw new DBError(400, 'Order ID is required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get order status and items
        const [orders] = await connection.execute('SELECT status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
        if (orders.length === 0) {
            throw new DBError(404, 'Order not found');
        }
        if (orders[0].status === 'cancelled') {
            throw new DBError(400, 'Order is already cancelled');
        }
        if (orders[0].status === 'shipped' || orders[0].status === 'delivered') {
            throw new DBError(400, `Cannot cancel order in ${orders[0].status} status`);
        }

        const [items] = await connection.execute('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);

        // 2. Update status
        await connection.execute('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);

        // 3. Restore stock
        for (const item of items) {
            if (item.product_id) {
                await connection.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
            }
        }

        await connection.commit();
        return { success: true, message: 'Order cancelled and stock restored' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Cancel order error:', error);
        throw new DBError(500, 'Failed to cancel order');
    } finally {
        connection.release();
    }
};

func.requestRefund = async function (orderId, productId) {
    if (!orderId || !productId) {
        throw new DBError(400, 'Order ID and Product ID are required');
    }
    try {
        // 1. Get order info (must be delivered and within 30 days)
        const [orders] = await pool.execute('SELECT user_id, status, created_at FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) throw new DBError(404, 'Order not found');

        const order = orders[0];
        if (order.status !== 'delivered') {
            throw new DBError(400, 'Only delivered orders can be refunded');
        }

        const orderDate = new Date(order.created_at);
        const now = new Date();
        const diffDays = Math.ceil(Math.abs(now - orderDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 30) {
            throw new DBError(400, 'Refund request period (30 days) has expired');
        }

        // 2. Get item info
        const [items] = await pool.execute('SELECT price_at_purchase FROM order_items WHERE order_id = ? AND product_id = ?', [orderId, productId]);
        if (items.length === 0) throw new DBError(404, 'Product not found in this order');

        const refundAmount = items[0].price_at_purchase;

        // 3. Create refund request
        const [result] = await pool.execute(
            'INSERT INTO refunds (order_id, product_id, user_id, refund_amount, status) VALUES (?, ?, ?, ?, ?)',
            [orderId, productId, order.user_id, refundAmount, 'pending']
        );

        return { success: true, message: 'Refund request submitted', refundId: result.insertId };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Request refund error:', error);
        throw new DBError(500, 'Failed to request refund');
    }
};

func.approveRefund = async function (refundId) {
    if (!refundId) {
        throw new DBError(400, 'Refund ID is required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get refund info
        const [refunds] = await connection.execute('SELECT * FROM refunds WHERE id = ? FOR UPDATE', [refundId]);
        if (refunds.length === 0) throw new DBError(404, 'Refund request not found');

        const refund = refunds[0];
        if (refund.status !== 'pending') {
            throw new DBError(400, `Refund is already ${refund.status}`);
        }

        // 2. Get item quantity from order
        const [items] = await connection.execute('SELECT quantity FROM order_items WHERE order_id = ? AND product_id = ?', [refund.order_id, refund.product_id]);
        const quantity = items.length > 0 ? items[0].quantity : 0;

        // 3. Update refund status
        await connection.execute('UPDATE refunds SET status = ? WHERE id = ?', ['approved', refundId]);

        // 4. Restore stock
        if (refund.product_id && quantity > 0) {
            await connection.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [quantity, refund.product_id]);
        }

        await connection.commit();
        return { success: true, message: 'Refund approved and stock restored' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Approve refund error:', error);
        throw new DBError(500, 'Failed to approve refund');
    } finally {
        connection.release();
    }
};

func.hasUserAlreadyCommented = async function (userId, productId) {
    try {
        const [rows] = await pool.execute(`
            SELECT id, status, comment_text, edited_text, name_snapshot FROM comments c
            WHERE c.user_id = ? AND c.product_id = ?
            LIMIT 1
        `, [userId, productId]);
        return rows.length > 0 ? { id: rows[0].id, status: rows[0].status, comment_text: rows[0].comment_text, edited_text: rows[0].edited_text, name_snapshot: rows[0].name_snapshot } : false;
    } catch (error) {
        console.error('Check purchase error:', error);
        return false;
    }
};

func.getCart = async function (userId) {
    if (!userId) throw new DBError(400, 'User ID is required');
    try {
        const [rows] = await pool.execute(`
            SELECT c.*, p.name AS product_name, p.price AS product_price, p.image_url, pv.variant_code AS variant_code 
            FROM cart c 
            JOIN products p ON c.product_id = p.id 
            LEFT JOIN product_variants pv ON c.variant_id = pv.id AND pv.product_id = c.product_id
            WHERE c.user_id = ?
        `, [userId]);
        return { success: true, cart: rows };
    } catch (error) {
        console.error('Get cart error:', error);
        throw new DBError(500, 'Failed to fetch cart');
    }
}

func.addToCart = async function (userId, productId, quantity = 1, options, variantId = null) {
    if (!userId || !productId) throw new DBError(400, 'User ID and Product ID are required');
    try {
        let sql = 'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?';
        let params = [userId, productId];

        if (options !== undefined && options !== null) {
            sql += ' AND options = ?';
            params.push(options);
        } else {
            sql += ' AND options IS NULL';
        }

        if (variantId !== null) {
            sql += ' AND variant_id = ?';
            params.push(variantId);
        } else {
            sql += ' AND variant_id IS NULL';
        }

        const [existing] = await pool.execute(sql, params);

        if (existing.length > 0) {
            await pool.execute('UPDATE cart SET quantity = quantity + ? WHERE id = ?', [quantity, existing[0].id]);
        } else {
            await pool.execute('INSERT INTO cart (user_id, product_id, variant_id, quantity, options) VALUES (?, ?, ?, ?, ?)', [userId, productId, variantId, quantity, options || null]);
        }
        return { success: true, message: 'Item added to cart' };
    } catch (error) {
        console.error('Add to cart error:', error);
        throw new DBError(500, 'Failed to add item to cart');
    }
}

func.modifyCartItem = async function (userId, itemId, quantity, options, variantId = null) {
    if (!userId || !itemId) throw new DBError(400, 'User ID and Item ID are required');
    try {
        let sql = 'UPDATE cart SET ';
        let params = [];
        let updates = [];

        if (quantity !== undefined) {
            updates.push('quantity = ?');
            params.push(quantity);
        }
        if (options !== undefined) {
            updates.push('options = ?');
            params.push(options);
        }

        if (variantId !== null) {
            updates.push('variant_id = ?');
            params.push(variantId);
        }

        if (updates.length > 0) {
            sql += updates.join(', ') + ' WHERE id = ? AND user_id = ?';
            params.push(itemId, userId);
            const [result] = await pool.execute(sql, params);
            if (result.affectedRows === 0) throw new DBError(404, 'Cart item not found');
        }
        return { success: true, message: 'Cart item updated' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Modify cart item error:', error);
        throw new DBError(500, 'Failed to modify cart item');
    }
}

func.deleteCartItem = async function (userId, itemId) {
    if (!userId || !itemId) throw new DBError(400, 'User ID and Item ID are required');
    try {
        const [result] = await pool.execute('DELETE FROM cart WHERE id = ? AND user_id = ?', [itemId, userId]);
        if (result.affectedRows === 0) throw new DBError(404, 'Cart item not found');
        return { success: true, message: 'Cart item removed' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Delete cart item error:', error);
        throw new DBError(500, 'Failed to delete cart item');
    }
}

func.clearCart = async function (userId) {
    if (!userId) throw new DBError(400, 'User ID is required');
    try {
        await pool.execute('DELETE FROM cart WHERE user_id = ?', [userId]);
        return { success: true, message: 'Cart cleared' };
    } catch (error) {
        console.error('Clear cart error:', error);
        throw new DBError(500, 'Failed to clear cart');
    }
}

func.getAddresses = async function (userId, addressId = null) {
    if (!userId) throw new DBError(400, 'User ID is required');
    try {
        let sql = 'SELECT * FROM addresses WHERE user_id = ?';
        let params = [userId];
        if (addressId) {
            sql += ' AND id = ?';
            params.push(addressId);
        }
        const [rows] = await pool.execute(sql, params);
        if (addressId && rows.length === 0) throw new DBError(404, 'Address not found');
        return { success: true, addresses: rows };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Get addresses error:', error);
        throw new DBError(500, 'Failed to fetch addresses');
    }
}

func.saveAddress = async function (userId, addressEnc) {
    if (!userId || !addressEnc) throw new DBError(400, 'User ID and address are required');
    try {
        const [result] = await pool.execute(
            'INSERT INTO addresses (user_id, address) VALUES (?, ?)',
            [userId, addressEnc]
        );
        return { success: true, message: 'Address saved successfully', addressId: result.insertId };
    } catch (error) {
        console.error('Save address error:', error);
        throw new DBError(500, 'Failed to save address');
    }
}

func.editAddress = async function (userId, addressId, addressEnc) {
    if (!userId || !addressId || !addressEnc) throw new DBError(400, 'All fields are required');
    try {
        const [result] = await pool.execute(
            'UPDATE addresses SET address = ? WHERE id = ? AND user_id = ?',
            [addressEnc, addressId, userId]
        );
        if (result.affectedRows === 0) throw new DBError(404, 'Address not found');
        return { success: true, message: 'Address updated successfully' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Edit address error:', error);
        throw new DBError(500, 'Failed to edit address');
    }
}

func.deleteAddress = async function (userId, addressId) {
    if (!userId || !addressId) throw new DBError(400, 'User ID and Address ID are required');
    try {
        const [result] = await pool.execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [addressId, userId]);
        if (result.affectedRows === 0) throw new DBError(404, 'Address not found');
        return { success: true, message: 'Address deleted successfully' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Delete address error:', error);
        throw new DBError(500, 'Failed to delete address');
    }
}

module.exports = {
    DBError,
    ...func
};




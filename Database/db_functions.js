const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const aes = require('../Backend/components/aes256.js');

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
let categorySortOrderColumnReady = false;
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
            [displayname, username, hashedPassword, !config.verifyemail, 'Customer', displayname.split(" ").map(n => "s").join("")]
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
        await pool.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        return { success: true, message: 'Login successful', userId: user.id };
    } catch (error) {
        if (error instanceof DBError) throw error; // Re-throw known DBErrors
        console.error('Login error:', error);
        throw new DBError(500, 'Internal server error');
    }
};

func.editUser = async function (userId, newDisplayName, newNamePrivacy, newEmailBlock, newTaxId = null) {
    if (!userId || !newDisplayName || !newNamePrivacy) {
        throw new DBError(400, 'User ID, display name, and name privacy are required');
    }
    try {
        const [result] = await pool.execute(
            'UPDATE users SET displayname = ?, nameprivacy = ?, tax_id = ? WHERE id = ?',
            [newDisplayName, newNamePrivacy, newTaxId, userId]
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
            'SELECT id, displayname, username, verified, role, nameprivacy, tax_id, emailblocked, created_at, last_login FROM users WHERE ' + (id ? 'id = ?' : 'username = ?'),
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

func.enrichProductsWithOptions = async function (userId, products, adminView = false) {
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
        ORDER BY pog.priority ASC, pog.id ASC, pov.sort_order ASC, pov.id ASC
    `, [productIds]);

    // Fetch variants
    const [variants] = await pool.query(`
        SELECT pv.id as variant_id, pv.product_id, pv.variant_code, pv.price_add, pv.price_mult, pv.cost, pv.stock, pv.discount_rate,
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
        p.is_wishlisted = !!p.is_wishlisted;
        if (p.users_wishing_for_product !== undefined && p.users_wishing_for_product === null) {
            p.users_wishing_for_product = 0;
        }
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
                if (!adminView) {
                    delete groups[opt.group_id].values[groups[opt.group_id].values.length - 1].price_add;
                    delete groups[opt.group_id].values[groups[opt.group_id].values.length - 1].price_mult;
                }
            }
        }
        p.options.push(...Object.values(groups));

        if (!p.has_variants) {
            p.variants = [];
            continue;
        }

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
                    price_add: parseFloat(v.price_add ?? 0),
                    price_mult: parseFloat(v.price_mult ?? 1),
                    cost: parseFloat(v.cost ?? 0),
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
func.getAllProducts = async function (userId,isManager = false) {
    try {
        let q = [];
        let w = "LEFT JOIN wishlist w ON w.product_id = p.id AND w.user_id = ?";
        let ww = ", (w.product_id IS NOT NULL) AS is_wishlisted";
        if (userId) q.push(userId);
        else {w = "";ww = "";}
        if (userId && isManager) {
            w += "\nLEFT JOIN (SELECT product_id, COUNT(user_id) AS users_wishing_for_product FROM wishlist GROUP BY product_id) ww ON ww.product_id = p.id";
            ww += ", ww.users_wishing_for_product AS users_wishing_for_product";
        }
        let [rows] = await pool.execute(`
            SELECT p.*, c.name AS category_name, pc.name AS parent_category_name, r.averageRating AS averageRating${ww}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            LEFT JOIN (
                SELECT product_id, ROUND(AVG(rating) / 2, 2) AS averageRating
                FROM comments
                WHERE rating IS NOT NULL
                GROUP BY product_id
            ) r ON r.product_id = p.id
            ${w}
        `, q);
        rows = await func.enrichProductsWithOptions(userId, rows, isManager);
        return { success: true, products: rows };
    } catch (error) {
        console.error('Get all products error:', error);
        throw new DBError(500, 'Failed to fetch products: ' + error.message);
    }
};
func.getProductsByIds = async function (userId, productId, isUrl = false, isManager = false) {
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    try {
        let q = [];
        let w = "LEFT JOIN wishlist w ON w.product_id = p.id AND w.user_id = ?";
        let ww = ", (w.product_id IS NOT NULL) AS is_wishlisted";
        if (userId) q.push(userId);
        else {w = "";ww = "";}
        if (userId && isManager) {
            w += "\nLEFT JOIN (SELECT product_id, COUNT(user_id) AS users_wishing_for_product FROM wishlist GROUP BY product_id) ww ON ww.product_id = p.id";
            ww += ", ww.users_wishing_for_product AS users_wishing_for_product";
        }
        productId = Array.isArray(productId) ? productId : [productId];
        let [rows] = await pool.query(`
            SELECT p.*, c.name AS category_name, pc.name AS parent_category_name, r.averageRating AS averageRating${ww}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            LEFT JOIN (
                SELECT product_id, ROUND(AVG(rating) / 2, 2) AS averageRating
                FROM comments
                WHERE rating IS NOT NULL
                GROUP BY product_id
            ) r ON r.product_id = p.id
            ${w}
            WHERE p.${isUrl ? 'product_code' : 'id'} IN (?)
        `, [...q, productId]);
        if (rows.length === 0) {
            throw new DBError(404, 'No products found');
        }
        rows = await func.enrichProductsWithOptions(userId, rows, isManager);
        const foundIds = rows.map(r => r["" + (isUrl ? 'product_code' : 'id')]);
        const missingIds = productId.filter(id => !foundIds.includes(id));
        return { success: true, products: rows, idsnotfound: missingIds };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Get products by IDs error:', error);
        throw new DBError(500, 'Failed to fetch products: ' + error.message);
    }
};

func.getTodaysPick = async function (userId, isManager = false) {
    try {
        let q = [];
        let w = "LEFT JOIN wishlist w ON w.product_id = p.id AND w.user_id = ?";
        let ww = ", (w.product_id IS NOT NULL) AS is_wishlisted";
        let personalizationJoins = "";
        let personalizationScore = "0 + 0";
        if (!userId) {w = "";ww = "";}
        if (userId && isManager) {
            w += "\nLEFT JOIN (SELECT product_id, COUNT(user_id) AS users_wishing_for_product FROM wishlist GROUP BY product_id) ww ON ww.product_id = p.id";
            ww += ", ww.users_wishing_for_product AS users_wishing_for_product";
        }
        if (userId) {
            personalizationJoins = `
            LEFT JOIN (
                SELECT product_id, COUNT(*) AS current_user_wishlist_count
                FROM wishlist
                WHERE user_id = ?
                GROUP BY product_id
            ) user_wish ON user_wish.product_id = p.id
            LEFT JOIN (
                SELECT product_id, SUM(GREATEST(quantity, 1)) AS current_user_cart_quantity
                FROM cart
                WHERE user_id = ?
                GROUP BY product_id
            ) user_cart ON user_cart.product_id = p.id
            LEFT JOIN (
                SELECT p2.category_id, COUNT(*) AS current_user_category_deliveries
                FROM delivered_items di
                JOIN products p2 ON p2.id = di.product_id
                WHERE di.user_id = ?
                GROUP BY p2.category_id
            ) user_delivered_category ON user_delivered_category.category_id <=> p.category_id
            `;
            personalizationScore = `
                    (LEAST(COALESCE(user_wish.current_user_wishlist_count, 0), 1) * 90) +
                    (LEAST(COALESCE(user_cart.current_user_cart_quantity, 0), 5) * 18) +
                    (LEAST(COALESCE(user_delivered_category.current_user_category_deliveries, 0), 10) * 7)
            `;
            q.push(userId, userId, userId);
        }
        if (userId) q.push(userId);
        const [rows] = await pool.execute(`
            SELECT p.*, c.name AS category_name, pc.name AS parent_category_name, r.averageRating AS averageRating${ww},
                   COALESCE(v.variant_stock, p.stock, 0) AS pick_stock,
                   COALESCE(r.review_count, 0) AS pick_review_count,
                   COALESCE(cart.cart_count, 0) AS pick_cart_count,
                   COALESCE(wish.wishlist_count, 0) AS pick_wishlist_count,
                   COALESCE(delivered.delivered_count, 0) AS pick_delivered_count
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            LEFT JOIN (
                SELECT product_id, ROUND(AVG(rating) / 2, 2) AS averageRating, COUNT(*) AS review_count
                FROM comments
                WHERE rating IS NOT NULL AND status = 'approved'
                GROUP BY product_id
            ) r ON r.product_id = p.id
            LEFT JOIN (
                SELECT product_id, SUM(GREATEST(COALESCE(stock, 0), 0)) AS variant_stock
                FROM product_variants
                GROUP BY product_id
            ) v ON v.product_id = p.id
            LEFT JOIN (
                SELECT product_id, COUNT(*) AS cart_count
                FROM cart
                GROUP BY product_id
            ) cart ON cart.product_id = p.id
            LEFT JOIN (
                SELECT product_id, COUNT(*) AS wishlist_count
                FROM wishlist
                GROUP BY product_id
            ) wish ON wish.product_id = p.id
            LEFT JOIN (
                SELECT product_id, COUNT(*) AS delivered_count
                FROM delivered_items
                GROUP BY product_id
            ) delivered ON delivered.product_id = p.id
            ${personalizationJoins}
            ${w}
            ORDER BY
                CASE WHEN COALESCE(v.variant_stock, p.stock, 0) > 0 THEN 1 ELSE 0 END DESC,
                (
                    ${personalizationScore}
                ) DESC,
                CASE WHEN c.name = 'Coffee' OR pc.name = 'Coffee' THEN 1 ELSE 0 END DESC,
                (
                    (COALESCE(r.averageRating, 0) * 100) +
                    (LEAST(COALESCE(r.review_count, 0), 20) * 4) +
                    (LEAST(COALESCE(cart.cart_count, 0), 30) * 3) +
                    (LEAST(COALESCE(wish.wishlist_count, 0), 30) * 2) +
                    (LEAST(COALESCE(delivered.delivered_count, 0), 50) * 2) +
                    (COALESCE(p.discount_rate, 0) * 3) +
                    LEAST(COALESCE(p.sales, 0), 100) +
                    (MOD((p.id * 37) + TO_DAYS(CURRENT_DATE), 31) * 2)
                ) DESC,
                p.created_at DESC,
                p.id ASC
            LIMIT 1
        `, q);
        if (rows.length === 0) {
            return { success: true, product: null, reason: 'No products are available right now.' };
        }
        const product = (await func.enrichProductsWithOptions(userId, rows, isManager))[0];
        return {
            success: true,
            product,
            personalized: !!userId,
        };
    } catch (error) {
        console.error('Get today pick error:', error);
        throw new DBError(500, 'Failed to fetch today pick: ' + error.message);
    }
};

func.searchProducts = async function (userId, query, sortBy = 'newest', isManager = false) {
    try {
        let q = [];
        let w = "LEFT JOIN wishlist w ON w.product_id = p.id AND w.user_id = ?";
        let ww = ", (w.product_id IS NOT NULL) AS is_wishlisted";
        if (userId) q.push(userId);
        else {w = "";ww = "";}
        if (userId && isManager) {
            w += "\nLEFT JOIN (SELECT product_id, COUNT(user_id) AS users_wishing_for_product FROM wishlist GROUP BY product_id) ww ON ww.product_id = p.id";
            ww += ", ww.users_wishing_for_product AS users_wishing_for_product";
        }
        let sql = `
            SELECT p.*, c.name AS category_name, pc.name AS parent_category_name, r.averageRating AS averageRating${ww}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            LEFT JOIN (
                SELECT product_id, ROUND(AVG(rating) / 2, 2) AS averageRating
                FROM comments
                WHERE rating IS NOT NULL
                GROUP BY product_id
            ) r ON r.product_id = p.id
            ${w}
            WHERE p.name LIKE ? OR p.description LIKE ?
        `;
        const params = [...q, `%${query}%`, `%${query}%` || ''];

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
        rows = await func.enrichProductsWithOptions(userId, rows, isManager);
        return { success: true, products: rows };
    } catch (error) {
        console.error('Search products error:', error);
        throw new DBError(500, 'Failed to search products');
    }
};

async function ensureCategorySortOrderColumn() {
    if (categorySortOrderColumnReady) return;

    const [columns] = await pool.execute(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'sort_order'
    `, [config.database]);

    if (!columns.length) {
        await pool.execute('ALTER TABLE categories ADD COLUMN sort_order INT DEFAULT 0');
    }

    categorySortOrderColumnReady = true;
}

func.getCategories = async function (parent = null) {
    try {
        await ensureCategorySortOrderColumn();
        let query = 'SELECT * FROM categories ';
        const params = [];
        if (parent !== undefined) {
            query += ' WHERE parent_id ' + (parent === null ? 'IS NULL' : '= ?');
            if (parent !== null) params.push(parent);
        }
        query += ' ORDER BY sort_order ASC, id ASC';
        const [rows] = await pool.execute(query, params);
        let [rows2] = [[]];
        if (parent !== null) [rows2] = await pool.execute('SELECT * FROM products WHERE category_id IN (SELECT id FROM categories WHERE id = ?)', [params[0]]);
        for (let c of rows) {
            const subs = await func.getCategories(c.id);
            c.categories = subs.categories;
            c.products = subs.products;
        }
        return { success: true, categories: rows, products: rows2 };
    } catch (error) {
        console.error('Get categories error:', error);
        throw new DBError(500, 'Failed to fetch categories');
    }
};

func.addCategory = async function (name, parent_id = null) {
    const categoryName = String(name || "").trim();
    const parentId = parent_id ? Number(parent_id) : null;
    if (!categoryName) {
        throw new DBError(400, 'Category name is required');
    }
    try {
        await ensureCategorySortOrderColumn();
        if (parentId) {
            const [parents] = await pool.execute('SELECT id FROM categories WHERE id = ?', [parentId]);
            if (!parents.length) {
                throw new DBError(404, 'Parent category not found');
            }
        }
        const [orders] = await pool.execute(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM categories WHERE parent_id ' + (parentId ? '= ?' : 'IS NULL'),
            parentId ? [parentId] : []
        );
        const [result] = await pool.execute(
            'INSERT INTO categories (name, parent_id, sort_order) VALUES (?, ?, ?)',
            [categoryName, parentId, Number(orders[0] && orders[0].next_order) || 0]
        );
        return { success: true, message: 'Category added successfully', categoryId: result.insertId };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Add category error:', error);
        throw new DBError(500, 'Failed to add category: ' + error.message);
    }
};

func.updateCategory = async function (categoryId, name, parent_id = null, sort_order = undefined) {
    const normalizedCategoryId = Number(categoryId);
    const categoryName = String(name || "").trim();
    const parentId = parent_id ? Number(parent_id) : null;
    const nextSortOrder = sort_order === undefined ? null : Number(sort_order);
    if (!Number.isFinite(normalizedCategoryId) || normalizedCategoryId <= 0) {
        throw new DBError(400, 'Category ID is required');
    }
    if (!categoryName) {
        throw new DBError(400, 'Category name is required');
    }
    if (parentId === normalizedCategoryId) {
        throw new DBError(400, 'A category cannot be its own parent');
    }
    if (sort_order !== undefined && !Number.isFinite(nextSortOrder)) {
        throw new DBError(400, 'Category sort order must be a number');
    }
    const connection = await pool.getConnection();
    try {
        await ensureCategorySortOrderColumn();
        await connection.beginTransaction();
        const [categories] = await connection.execute('SELECT id FROM categories WHERE id = ? FOR UPDATE', [normalizedCategoryId]);
        if (!categories.length) {
            throw new DBError(404, 'Category not found');
        }
        if (parentId) {
            const [parents] = await connection.execute('SELECT id FROM categories WHERE id = ?', [parentId]);
            if (!parents.length) {
                throw new DBError(404, 'Parent category not found');
            }

            const pendingIds = [normalizedCategoryId];
            const descendantIds = new Set();
            while (pendingIds.length) {
                const currentId = pendingIds.pop();
                const [children] = await connection.execute('SELECT id FROM categories WHERE parent_id = ?', [currentId]);
                for (const child of children) {
                    const childId = Number(child.id);
                    if (descendantIds.has(childId)) continue;
                    descendantIds.add(childId);
                    pendingIds.push(childId);
                }
            }
            if (descendantIds.has(parentId)) {
                throw new DBError(400, 'A category cannot be moved under one of its subcategories');
            }
        }

        const updateFields = ['name = ?', 'parent_id = ?'];
        const updateValues = [categoryName, parentId];
        if (sort_order !== undefined) {
            updateFields.push('sort_order = ?');
            updateValues.push(Math.round(nextSortOrder));
        }
        updateValues.push(normalizedCategoryId);
        const [result] = await connection.execute(
            `UPDATE categories SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Category not found');
        }
        await connection.commit();
        return { success: true, message: 'Category updated successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Update category error:', error);
        throw new DBError(500, 'Failed to update category: ' + error.message);
    } finally {
        connection.release();
    }
};

func.deleteCategory = async function (categoryId) {
    if (!categoryId) {
        throw new DBError(400, 'Category ID is required');
    }
    try {
        const [result] = await pool.execute(
            'DELETE FROM categories WHERE id = ?',
            [categoryId]
        );
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Category not found');
        }
        return { success: true, message: 'Category deleted successfully' };
    } catch (error) {
        console.error('Delete category error:', error);
        throw new DBError(500, 'Failed to delete category: ' + error.message);
    }
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

let productDesignColumnsReady = false;

async function ensureProductDesignColumns(connection) {
    if (productDesignColumnsReady) {
        return;
    }

    const requiredColumns = {
        model: 'VARCHAR(255) DEFAULT NULL',
        serial_number: 'VARCHAR(255) DEFAULT NULL',
        warranty_status: 'VARCHAR(255) DEFAULT NULL',
        distributor_information: 'VARCHAR(255) DEFAULT NULL'
    };
    const [columns] = await connection.execute(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'products'
          AND COLUMN_NAME IN (?, ?, ?, ?)
    `, Object.keys(requiredColumns));
    const existingColumns = new Set(columns.map(column => column.COLUMN_NAME));

    for (const [columnName, definition] of Object.entries(requiredColumns)) {
        if (!existingColumns.has(columnName)) {
            await connection.execute(`ALTER TABLE products ADD COLUMN \`${columnName}\` ${definition}`);
        }
    }

    productDesignColumnsReady = true;
}

function normalizeProductText(value, label, required = false) {
    const text = typeof value === 'string' || typeof value === 'number'
        ? String(value).trim()
        : '';

    if (required && !text) {
        throw new DBError(400, `${label} is required`);
    }

    return text || null;
}

function normalizeProductNumber(value, label, { integer = false } = {}, required = false) {
    if (value === undefined || value === null || value === '') {
        if (required) throw new DBError(400, `${label} is required`);
        else return 0;
    }

    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
        throw new DBError(400, `${label} must be a non-negative number`);
    }

    return integer ? Math.floor(numberValue) : numberValue;
}

func.addProduct = async function (data) {
    data = data || {};
    const {
        product_code, name, description, price, cost, stock, has_variants,
        category_id, weight, tax, origin, roast_level, acidity, flavor_notes,
        material, capacity, image_url, discount_rate,
        warranty_status, distributor_information
    } = data;
    const model = normalizeProductText(data.model, 'Model', false); // OPTIONAL!
    const serial_number = normalizeProductText(data.serial_number ?? data.serialNumber ?? product_code, 'Serial number', false); // OPTIONAL!
    const productName = normalizeProductText(name, 'Name', true);
    const productDescription = normalizeProductText(description, 'Description', false); // OPTIONAL!
    const productPrice = normalizeProductNumber(price, 'Price', {}, true);
    const productStock = normalizeProductNumber(stock, 'Stock', { integer: true }, true);
    const warrantyStatus = normalizeProductText(warranty_status ?? data.warrantyStatus, 'Warranty status', false); // OPTIONAL!
    const distributorInformation = normalizeProductText(distributor_information ?? data.distributorInformation, 'Distributor information', false); // OPTIONAL!
    const connection = await pool.getConnection();
    try {
        await ensureProductDesignColumns(connection);
        await connection.beginTransaction();
        const [result] = await connection.execute(`
            INSERT INTO products (
                product_code, model, serial_number, name, description, price, cost, stock, has_variants,
                category_id, weight, tax, origin, roast_level, acidity, flavor_notes,
                material, capacity, discount_rate, warranty_status, distributor_information
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            product_code || null, model, serial_number, productName, productDescription, productPrice, cost || 0.00, productStock, has_variants || false,
            category_id || null, weight || null, tax || 0, origin || null, roast_level || null, acidity || null, flavor_notes || null,
            material || null, capacity || null, discount_rate || 0.00, warrantyStatus, distributorInformation
        ]);
        const productId = result.insertId;

        if (image_url) {
            await connection.execute(`
                INSERT INTO product_images (product_id, image_url, is_primary)
                VALUES (?, ?, true)
            `, [productId, image_url]);
        }

        await connection.commit();
        return { success: true, message: 'Product added successfully', productId };
    } catch (error) {
        await connection.rollback();
        console.error('Add product error:', error);
        throw new DBError(500, 'Failed to add product: ' + error.message);
    } finally {
        connection.release();
    }
};

function buildOptionCode(value, fallback) {
    const raw = String(value || fallback || "").trim().toLowerCase();
    const code = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return code || null;
}

async function syncProductVariantFlag(connection, productId) {
    const [variantRows] = await connection.execute('SELECT COUNT(*) AS count FROM product_variants WHERE product_id = ?', [productId]);
    const [optionRows] = await connection.execute('SELECT COUNT(*) AS count FROM product_option_groups WHERE product_id = ?', [productId]);
    const hasVariants = Number(variantRows[0] && variantRows[0].count) > 0 || Number(optionRows[0] && optionRows[0].count) > 0;
    await connection.execute('UPDATE products SET has_variants = ? WHERE id = ?', [hasVariants, productId]);
}

async function deleteVariantsForOptionValues(connection, optionValueIds) {
    const ids = (Array.isArray(optionValueIds) ? optionValueIds : [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0);
    if (!ids.length) return;

    const [variantRows] = await connection.query(
        'SELECT DISTINCT product_variant_id AS id FROM product_variant_values WHERE product_option_value_id IN (?)',
        [ids]
    );
    const variantIds = variantRows.map(row => Number(row.id)).filter(id => Number.isFinite(id) && id > 0);
    if (variantIds.length) {
        await connection.query('DELETE FROM product_variants WHERE id IN (?)', [variantIds]);
    }
}

async function buildVariantCodeForOptionValueIds(connection, optionValueIds) {
    const ids = (Array.isArray(optionValueIds) ? optionValueIds : [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0);
    if (!ids.length) return null;

    const [optRows] = await connection.query(`
        SELECT pog.group_code, pov.value_code
        FROM product_option_values pov
        JOIN product_option_groups pog ON pov.product_option_group_id = pog.id
        WHERE pov.id IN (?)
    `, [ids]);

    const optionMap = {};
    for (const row of optRows) {
        if (row.group_code && row.value_code) {
            optionMap[row.group_code] = row.value_code;
        }
    }
    return Object.keys(optionMap).length
        ? Buffer.from(JSON.stringify(optionMap)).toString('base64')
        : null;
}

async function syncVariantOptionValueMappings(connection, variantId, optionValueIds) {
    const normalizedVariantId = Number(variantId);
    const normalizedIds = Array.from(new Set((Array.isArray(optionValueIds) ? optionValueIds : [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0)));

    const [existingRows] = await connection.execute(
        'SELECT product_option_value_id FROM product_variant_values WHERE product_variant_id = ?',
        [normalizedVariantId]
    );
    const existingIds = new Set(
        existingRows
            .map(row => Number(row.product_option_value_id))
            .filter(id => Number.isFinite(id) && id > 0)
    );
    const nextIds = new Set(normalizedIds);

    const idsToRemove = [...existingIds].filter(id => !nextIds.has(id));
    const idsToAdd = normalizedIds.filter(id => !existingIds.has(id));

    if (idsToRemove.length > 0) {
        await connection.execute(
            'DELETE FROM product_variant_values WHERE product_variant_id = ? AND product_option_value_id IN (?)',
            [normalizedVariantId, idsToRemove]
        );
    }

    for (const optionValueId of idsToAdd) {
        await connection.execute(
            'INSERT INTO product_variant_values (product_variant_id, product_option_value_id) VALUES (?, ?)',
            [normalizedVariantId, optionValueId]
        );
    }

    return idsToRemove.length > 0 || idsToAdd.length > 0;
}

func.addProductOption = async function (data) {
    const { product_id, name, group_code, value_label, value_code } = data;
    const normalizedProductId = Number(product_id);
    const groupName = String(name || "").trim();
    const valueLabel = String(value_label || "").trim();
    if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
        throw new DBError(400, 'Product ID is required');
    }
    if (!groupName) {
        throw new DBError(400, 'Option name is required');
    }
    if (!valueLabel) {
        throw new DBError(400, 'Option value is required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [products] = await connection.execute('SELECT id FROM products WHERE id = ? FOR UPDATE', [normalizedProductId]);
        if (!products.length) {
            throw new DBError(404, 'Product not found');
        }
        const [groupResult] = await connection.execute(`
            INSERT INTO product_option_groups (
                product_id, name, group_code, cumulative_stock, separate_stock, separate_price, is_required, multi_select, priority
            ) VALUES (?, ?, ?, FALSE, FALSE, FALSE, TRUE, FALSE, 1)
        `, [normalizedProductId, groupName, buildOptionCode(group_code, groupName)]);
        const optionGroupId = groupResult.insertId;
        const [valueResult] = await connection.execute(`
            INSERT INTO product_option_values (
                product_option_group_id, label, value_code, price_add, price_mult, sort_order
            ) VALUES (?, ?, ?, 0.00, 1.0000, 0)
        `, [optionGroupId, valueLabel, buildOptionCode(value_code, valueLabel)]);
        await connection.execute('UPDATE products SET has_variants = TRUE WHERE id = ?', [normalizedProductId]);
        await connection.commit();
        return {
            success: true,
            message: 'Product option added successfully',
            optionGroupId,
            optionValueId: valueResult.insertId
        };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Add product option error:', error);
        throw new DBError(500, 'Failed to add product option: ' + error.message);
    } finally {
        connection.release();
    }
};

func.updateProductOption = async function (optionGroupId, data) {
    const normalizedOptionGroupId = Number(optionGroupId);
    if (!Number.isFinite(normalizedOptionGroupId) || normalizedOptionGroupId <= 0) {
        throw new DBError(400, 'Option ID is required');
    }

    const allowedFields = [];
    const values = [];
    if (data.name !== undefined) {
        const name = String(data.name || "").trim();
        if (!name) {
            throw new DBError(400, 'Option name is required');
        }
        allowedFields.push('name = ?');
        values.push(name);
    }
    if (data.priority !== undefined) {
        const priority = Number(data.priority);
        if (!Number.isFinite(priority)) {
            throw new DBError(400, 'Option priority must be a number');
        }
        allowedFields.push('priority = ?');
        values.push(Math.round(priority));
    }
    if (!allowedFields.length) {
        throw new DBError(400, 'No option changes to save');
    }

    values.push(normalizedOptionGroupId);
    try {
        const [result] = await pool.execute(`UPDATE product_option_groups SET ${allowedFields.join(', ')} WHERE id = ?`, values);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Option not found');
        }
        return { success: true, message: 'Product option updated successfully' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Update product option error:', error);
        throw new DBError(500, 'Failed to update product option: ' + error.message);
    }
};

func.deleteProductOption = async function (optionGroupId) {
    const normalizedOptionGroupId = Number(optionGroupId);
    if (!Number.isFinite(normalizedOptionGroupId) || normalizedOptionGroupId <= 0) {
        throw new DBError(400, 'Option ID is required');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [groups] = await connection.execute(
            'SELECT product_id FROM product_option_groups WHERE id = ? FOR UPDATE',
            [normalizedOptionGroupId]
        );
        if (!groups.length) {
            throw new DBError(404, 'Option not found');
        }
        const productId = groups[0].product_id;
        const [values] = await connection.execute(
            'SELECT id FROM product_option_values WHERE product_option_group_id = ?',
            [normalizedOptionGroupId]
        );
        await deleteVariantsForOptionValues(connection, values.map(value => value.id));
        const [result] = await connection.execute('DELETE FROM product_option_groups WHERE id = ?', [normalizedOptionGroupId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Option not found');
        }
        await syncProductVariantFlag(connection, productId);
        await connection.commit();
        return { success: true, message: 'Product option deleted successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Delete product option error:', error);
        throw new DBError(500, 'Failed to delete product option: ' + error.message);
    } finally {
        connection.release();
    }
};

func.addProductOptionValue = async function (option_group_id, label, value_code) {
    const normalizedOptionGroupId = Number(option_group_id);
    const valueLabel = String(label || "").trim();
    if (!Number.isFinite(normalizedOptionGroupId) || normalizedOptionGroupId <= 0) {
        throw new DBError(400, 'Option ID is required');
    }
    if (!valueLabel) {
        throw new DBError(400, 'Variant name is required');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [groups] = await connection.execute(
            'SELECT id FROM product_option_groups WHERE id = ? FOR UPDATE',
            [normalizedOptionGroupId]
        );
        if (!groups.length) {
            throw new DBError(404, 'Option not found');
        }
        const [orders] = await connection.execute(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM product_option_values WHERE product_option_group_id = ?',
            [normalizedOptionGroupId]
        );
        const [result] = await connection.execute(`
            INSERT INTO product_option_values (
                product_option_group_id, label, value_code, price_add, price_mult, sort_order
            ) VALUES (?, ?, ?, 0.00, 1.0000, ?)
        `, [normalizedOptionGroupId, valueLabel, value_code, Number(orders[0].next_order) || 0]);
        await connection.commit();
        return { success: true, message: 'Option variant added successfully', optionValueId: result.insertId };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Add option variant error:', error);
        throw new DBError(500, 'Failed to add option variant: ' + error.message);
    } finally {
        connection.release();
    }
};

func.updateProductOptionValue = async function (optionValueId, data) {
    const normalizedOptionValueId = Number(optionValueId);
    if (!Number.isFinite(normalizedOptionValueId) || normalizedOptionValueId <= 0) {
        throw new DBError(400, 'Variant ID is required');
    }

    const fields = [];
    const values = [];
    if (data.label !== undefined || data.value_label !== undefined) {
        const label = String(data.label || data.value_label || "").trim();
        if (!label) {
            throw new DBError(400, 'Variant name is required');
        }
        fields.push('label = ?');
        values.push(label);
    }
    if (data.sort_order !== undefined) {
        const sortOrder = Number(data.sort_order);
        if (!Number.isFinite(sortOrder)) {
            throw new DBError(400, 'Variant sort order must be a number');
        }
        fields.push('sort_order = ?');
        values.push(Math.round(sortOrder));
    }
    if (data.option_group_id !== undefined || data.product_option_group_id !== undefined) {
        const optionGroupId = Number(data.option_group_id || data.product_option_group_id);
        if (!Number.isFinite(optionGroupId) || optionGroupId <= 0) {
            throw new DBError(400, 'Option ID is required');
        }
        fields.push('product_option_group_id = ?');
        values.push(optionGroupId);
    }
    if (!fields.length) {
        throw new DBError(400, 'No variant changes to save');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        if (data.option_group_id !== undefined || data.product_option_group_id !== undefined) {
            const optionGroupId = Number(data.option_group_id || data.product_option_group_id);
            const [groups] = await connection.execute('SELECT id FROM product_option_groups WHERE id = ?', [optionGroupId]);
            if (!groups.length) {
                throw new DBError(404, 'Option not found');
            }
        }
        values.push(normalizedOptionValueId);
        const [result] = await connection.execute(`UPDATE product_option_values SET ${fields.join(', ')} WHERE id = ?`, values);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Variant not found');
        }
        await connection.commit();
        return { success: true, message: 'Option variant updated successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Update option variant error:', error);
        throw new DBError(500, 'Failed to update option variant: ' + error.message);
    } finally {
        connection.release();
    }
};

func.deleteProductOptionValue = async function (optionValueId) {
    const normalizedOptionValueId = Number(optionValueId);
    if (!Number.isFinite(normalizedOptionValueId) || normalizedOptionValueId <= 0) {
        throw new DBError(400, 'Variant ID is required');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [values] = await connection.execute(`
            SELECT pov.id, pog.product_id, pov.product_option_group_id
            FROM product_option_values pov
            JOIN product_option_groups pog ON pov.product_option_group_id = pog.id
            WHERE pov.id = ? FOR UPDATE
        `, [normalizedOptionValueId]);
        if (!values.length) {
            throw new DBError(404, 'Variant not found');
        }
        const currentValue = values[0];
        const [countRows] = await connection.execute(
            'SELECT COUNT(*) AS count FROM product_option_values WHERE product_option_group_id = ?',
            [currentValue.product_option_group_id]
        );
        if (Number(countRows[0] && countRows[0].count) <= 1) {
            throw new DBError(400, 'An option must have at least one variant');
        }

        await deleteVariantsForOptionValues(connection, [normalizedOptionValueId]);
        const [result] = await connection.execute('DELETE FROM product_option_values WHERE id = ?', [normalizedOptionValueId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Variant not found');
        }
        await syncProductVariantFlag(connection, currentValue.product_id);
        await connection.commit();
        return { success: true, message: 'Option variant deleted successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Delete option variant error:', error);
        throw new DBError(500, 'Failed to delete option variant: ' + error.message);
    } finally {
        connection.release();
    }
};

func.addVariant = async function (data) {
    const { product_id, price_add, price_mult, cost, stock, discount_rate, option_value_ids } = data;
    if (!product_id) {
        throw new DBError(400, 'Product ID is required');
    }
    const normalizedPriceAdd = price_add === undefined || price_add === null ? 0.00 : Number(price_add);
    const normalizedPriceMult = price_mult === undefined || price_mult === null ? 1.0000 : Number(price_mult);
    const normalizedCost = cost === undefined || cost === null ? 0.00 : Number(cost);
    if (!Number.isFinite(normalizedPriceAdd) || normalizedPriceAdd < 0) {
        throw new DBError(400, 'Variant addition factor must be a non-negative number');
    }
    if (!Number.isFinite(normalizedPriceMult) || normalizedPriceMult < 0) {
        throw new DBError(400, 'Variant multiplication factor must be a non-negative number');
    }
    if (!Number.isFinite(normalizedCost) || normalizedCost < 0) {
        throw new DBError(400, 'Variant manufacturing cost must be a non-negative number');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let variant_code = data.variant_code || null;
        if (option_value_ids && option_value_ids.length > 0) {
            // Fetch group codes and value codes
            const [optRows] = await connection.query(`
                SELECT pog.group_code, pov.value_code
                FROM product_option_values pov
                JOIN product_option_groups pog ON pov.product_option_group_id = pog.id
                WHERE pov.id IN (?)
            `, [option_value_ids]);

            const optionMap = {};
            for (const row of optRows) {
                if (row.group_code && row.value_code) {
                    optionMap[row.group_code] = row.value_code;
                }
            }
            variant_code = Buffer.from(JSON.stringify(optionMap)).toString('base64');
        }

        const [result] = await connection.execute(`
            INSERT INTO product_variants (
                product_id, variant_code, price_add, price_mult, cost, stock, discount_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            product_id, variant_code, normalizedPriceAdd, normalizedPriceMult, normalizedCost, stock || 0, discount_rate || 0.00
        ]);

        const variantId = result.insertId;

        // Insert variant values mapping
        if (option_value_ids && option_value_ids.length > 0) {
            for (const valId of option_value_ids) {
                await connection.execute(`
                    INSERT INTO product_variant_values (product_variant_id, product_option_value_id)
                    VALUES (?, ?)
                `, [variantId, valId]);
            }
        }

        await connection.execute('UPDATE products SET has_variants = TRUE WHERE id = ?', [product_id]);

        await connection.commit();
        return { success: true, message: 'Variant added successfully', variantId };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Add variant error:', error);
        throw new DBError(500, 'Failed to add variant: ' + error.message);
    } finally {
        connection.release();
    }
};

func.updateVariant = async function (variantId, data) {
    if (!variantId) {
        throw new DBError(400, 'Variant ID is required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const updateData = { ...data };
        const option_value_ids = updateData.option_value_ids;
        if (option_value_ids !== undefined && Array.isArray(option_value_ids)) {
            updateData.variant_code = await buildVariantCodeForOptionValueIds(connection, option_value_ids);
        }
        delete updateData.option_value_ids;

        if (updateData.price_add !== undefined) {
            const normalizedPriceAdd = Number(updateData.price_add);
            if (!Number.isFinite(normalizedPriceAdd) || normalizedPriceAdd < 0) {
                throw new DBError(400, 'Variant addition factor must be a non-negative number');
            }
            updateData.price_add = normalizedPriceAdd;
        }
        if (updateData.price_mult !== undefined) {
            const normalizedPriceMult = Number(updateData.price_mult);
            if (!Number.isFinite(normalizedPriceMult) || normalizedPriceMult < 0) {
                throw new DBError(400, 'Variant multiplication factor must be a non-negative number');
            }
            updateData.price_mult = normalizedPriceMult;
        }
        if (updateData.cost !== undefined) {
            const normalizedCost = Number(updateData.cost);
            if (!Number.isFinite(normalizedCost) || normalizedCost < 0) {
                throw new DBError(400, 'Variant manufacturing cost must be a non-negative number');
            }
            updateData.cost = normalizedCost;
        }

        if (option_value_ids !== undefined) {
            await syncVariantOptionValueMappings(connection, variantId, option_value_ids);
        }

        if (Object.keys(updateData).length > 0) {
            const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
            const values = Object.values(updateData);
            values.push(variantId);
            const [result] = await connection.execute(`UPDATE product_variants SET ${fields} WHERE id = ?`, values);
            if (result.affectedRows === 0) {
                throw new DBError(404, 'Variant not found');
            }
        }

        await connection.commit();
        return { success: true, message: 'Variant updated successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Update variant error:', error);
        throw new DBError(500, 'Failed to update variant: ' + error.message);
    } finally {
        connection.release();
    }
};

func.deleteVariant = async function (variantId) {
    if (!variantId) {
        throw new DBError(400, 'Variant ID is required');
    }
    try {
        const [result] = await pool.execute('DELETE FROM product_variants WHERE id = ?', [variantId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Variant not found');
        }
        return { success: true, message: 'Variant deleted successfully' };
    } catch (error) {
        console.error('Delete variant error:', error);
        throw new DBError(500, 'Failed to delete variant: ' + error.message);
    }
};

func.updateProduct = async function (productId, data) {
    const connection = await pool.getConnection();
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    try {
        await connection.beginTransaction();
        if (!data || Object.keys(data).length === 0) {
            throw new DBError(400, 'No product changes to save');
        }
        if (data.category_id !== undefined && data.category_id !== null) {
            const normalizedCategoryId = Number(data.category_id);
            if (!Number.isFinite(normalizedCategoryId) || normalizedCategoryId <= 0) {
                throw new DBError(400, 'Category ID must be a valid category');
            }
            const [categories] = await connection.execute('SELECT id FROM categories WHERE id = ?', [normalizedCategoryId]);
            if (categories.length === 0) {
                throw new DBError(404, 'Category not found');
            }
            data.category_id = normalizedCategoryId;
        }
        if (data.cost !== undefined) {
            const normalizedCost = Number(data.cost);
            if (!Number.isFinite(normalizedCost) || normalizedCost < 0) {
                throw new DBError(400, 'Manufacturing cost must be a non-negative number');
            }
            data.cost = normalizedCost;
        }
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);
        productId = Number(productId);
        values.push(productId);
        if (Object.keys(data).includes("discount_rate") || Object.keys(data).includes("stock")) {
            const [old] = await connection.execute('SELECT stock, discount_rate FROM products WHERE id = ? FOR UPDATE', [productId]);
            if (old.length === 0) throw new DBError(404, 'Product not found');
            const previousStock = old[0].stock;
            const previousDiscount = old[0].discount_rate;
            if (previousStock === 0 && data.stock > 0) {
                await connection.execute("UPDATE wishlist w SET w.is_notified_about_stock = 'pending' WHERE w.product_id = ? AND w.is_notified_about_stock = 'waiting'", [productId]);
            }
            if (previousDiscount == 0 && data.discount_rate > 0 && old[0].stock > 0) {
                await connection.execute("UPDATE wishlist w SET w.is_notified_about_discount = 'pending' WHERE w.product_id = ? AND w.is_notified_about_discount = 'waiting'", [productId]);
            }
            if (previousStock > 0 && data.stock == 0) {
                await connection.execute("UPDATE wishlist w SET w.is_notified_about_stock = 'waiting' WHERE w.product_id = ?", [productId]);
            }
            if (previousDiscount > 0 && data.discount_rate == 0) {
                await connection.execute("UPDATE wishlist w SET w.is_notified_about_discount = 'waiting' WHERE w.product_id = ?", [productId]);
            }
        }
        const [result] = await connection.execute(`UPDATE products SET ${fields} WHERE id = ?`, values);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        await connection.commit();
        return { success: true, message: 'Product updated successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Update product error:', error);
        throw new DBError(500, 'Failed to update product');
    } finally {
        connection.release();
    }
};

func.removeProduct = async function (productId) {
    if (!productId) {
        throw new DBError(400, 'Product ID is required');
    }
    productId = Number(productId);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [products] = await connection.execute('SELECT * FROM products WHERE id = ? FOR UPDATE', [productId]);
        if (products.length === 0) {
            throw new DBError(404, 'Product not found');
        }

        const [result] = await connection.execute('DELETE FROM products WHERE id = ?', [productId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        await connection.commit();
        return { success: true, message: 'Product removed successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Remove product error:', error);
        throw new DBError(500, 'Failed to remove product');
    } finally {
        connection.release();
    }
};

func.applyDiscount = async function (productId, rate) {
    const connection = await pool.getConnection();
    productId = Number(productId);
    if (!productId || rate === undefined) {
        throw new DBError(400, 'Product ID and discount rate are required');
    }
    try {
        await connection.beginTransaction();
        const [old] = await connection.execute('SELECT price, stock, discount_rate FROM products WHERE id = ? FOR UPDATE', [productId]);
        if (old.length === 0) throw new DBError(404, 'Product not found');
        const previous = old[0].discount_rate;
        const [result] = await connection.execute('UPDATE products SET discount_rate = ? WHERE id = ?', [rate, productId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Product not found');
        }
        if (previous === 0 && rate > 0 && old[0].stock > 0) {
            // New discount applied, time to queue wishlisters!
            await connection.execute("UPDATE wishlist w SET w.is_notified_about_discount = 'pending' WHERE w.product_id = ? AND w.is_notified_about_discount = 'waiting'", [productId]);
        }
        await connection.commit();
        return { success: true, message: 'Discount applied successfully' };
    } catch (error) {
        await connection.rollback();
        console.error('Apply discount error:', error);
        throw new DBError(500, 'Failed to apply discount');
    } finally {
        connection.release();
    }
};

func.setVariantDiscount = async function (variantId, rate) {
    variantId = Number(variantId);
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
    const connection = await pool.getConnection();
    productId = Number(productId);
    try {
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
        await connection.rollback();
        console.error('Add product image error:', error);
        throw new DBError(500, 'Failed to add product image');
    } finally {
        connection.release();
    }
};

func.reorderProductImages = async function (productId, urlToOrder) {
    if (!productId || !urlToOrder || typeof urlToOrder !== 'object' || Array.isArray(urlToOrder)) {
        throw new DBError(400, 'Product ID and image order map are required');
    }
    productId = Number(productId);
    const entries = Object.entries(urlToOrder);
    if (entries.length === 0) {
        throw new DBError(400, 'Image order map cannot be empty');
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const [url, sortOrder] of entries) {
            const [result] = await connection.execute(
                'UPDATE product_images SET sort_order = ? WHERE product_id = ? AND image_url = ?',
                [sortOrder, productId, url]
            );
            if (result.affectedRows === 0) {
                throw new DBError(404, `Image with URL ${url} not found`);
            }
        }
        await connection.commit();
        return { success: true, message: 'Image order updated successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Reorder product images error:', error);
        throw new DBError(500, 'Failed to update image order');
    } finally {
        connection.release();
    }
};

func.setPrimaryImage = async function (productId, imageUrl) {
    if (!imageUrl) {
        throw new DBError(400, 'Image URL is required');
    }
    productId = Number(productId);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [result2] = await connection.execute(
            'UPDATE product_images SET is_primary = 1 WHERE product_id = ? AND image_url = ?',
            [productId, imageUrl]
        );
        if (result2.affectedRows === 0) {
            throw new DBError(404, 'Image or product not found');
        }
        await connection.execute(
            'UPDATE product_images SET is_primary = 0 WHERE product_id = ? AND is_primary = 1 AND image_url != ?',
            [productId, imageUrl]
        );
        await connection.commit();
        return { success: true, message: 'Primary image set successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Set primary image error:', error);
        throw new DBError(500, 'Failed to set primary image');
    } finally {
        connection.release();
    }
};

func.removeProductImage = async function (imageUrl) {
    if (!imageUrl) {
        throw new DBError(400, 'Image URL is required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.execute('DELETE FROM product_images WHERE image_url = ?', [imageUrl]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Image not found');
        }
        await connection.commit();
        return { success: true, message: 'Image removed successfully' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Remove product image error:', error);
        throw new DBError(500, 'Failed to remove product image');
    } finally {
        connection.release();
    }
};

func.deleteUser = async function (userId) {
    if (!userId) {
        throw new DBError(400, 'User ID is required');
    }
    // DO NOT UNCOMMENT. This is a dangerous operation that can cause data integrity issues if not handled with extreme care. Always prefer deactivation or anonymization over deletion in user management.
    // try {
    //     // Tokens are invalidated in the API layer before calling this, but we can also do it here if needed.
    //     // Most tables have ON DELETE CASCADE.
    //     const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    //     if (result.affectedRows === 0) {
    //         throw new DBError(404, 'User not found');
    //     }
    //     return { success: true, message: 'Account deleted successfully' };
    // } catch (error) {
    //     console.error('Delete user error:', error);
    //     throw new DBError(500, 'Failed to delete user account');
    // }
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
    productId = Number(productId);
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
    productId = Number(productId);
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
    productId = Number(productId);
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
func.updateOrderDetails = async function (orderId, details, restock = null) {
    if (!orderId || !details) {
        throw new DBError(400, 'Order ID and details are required');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.execute('UPDATE orders SET details = ? WHERE id = ?', [details, orderId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Order not found');
        }
        if (restock !== null) {
            await connection.execute('UPDATE products p SET p.stock = p.stock + ? WHERE p.id = ?', [restock.quantity, restock.productId]);
            if (restock.variantId) {
                await connection.execute('UPDATE product_variants pv SET pv.stock = pv.stock + ? WHERE pv.id = ?', [restock.quantity, restock.variantId]);
            }
        }
        await connection.commit();
        return { success: true, message: 'Order details updated successfully' };
    } catch (error) {
        await connection.rollback();
        console.error('Update order details error:', error);
        throw new DBError(500, 'Failed to update order details');
    } finally {
        connection.release();
    }
};
func.updateOrderStatus = async function (orderId, status, paymentId = null, restock = null) {
    const connection = await pool.getConnection();
    if (!orderId || !status) {
        throw new DBError(400, 'Order ID and status are required');
    }
    try {
        await connection.beginTransaction();
        const [result] = paymentId ? await connection.execute('UPDATE orders SET status = ?, purchaseId = ? WHERE id = ?', [status, paymentId, orderId]) : await connection.execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
        if (result.affectedRows === 0) {
            throw new DBError(404, 'Order not found');
        }
        if (restock !== null) {
            await connection.execute('UPDATE products p SET p.stock = p.stock + ? WHERE p.id = ?', [restock.quantity, restock.productId]);
            if (restock.variantId) {
                await connection.execute('UPDATE product_variants pv SET pv.stock = pv.stock + ? WHERE pv.id = ?', [restock.quantity, restock.variantId]);
            }
        }
        await connection.commit();
        return { success: true, message: 'Order status updated successfully' };
    } catch (error) {
        await connection.rollback();
        console.error('Update order status error:', error);
        throw new DBError(500, 'Failed to update order status');
    } finally {
        connection.release();
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
            await connection.execute('INSERT IGNORE INTO delivered_items (user_id, product_id) VALUES (?, ?)', [userId, p.product_id]);
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
func.getAllOrders = async function (orderId = null, startingDate = null, endingDate = null) {
    try {
        const [orders] = await pool.execute('SELECT o.*, u.displayname AS customer_name, u.username AS customer_email FROM orders o LEFT JOIN users u ON o.user_id = u.id' + (orderId ? ' WHERE o.id = ?' : '') + (startingDate ? ' AND o.created_at >= ?' : '') + (endingDate ? ' AND o.created_at <= ?' : '') + ' ORDER BY o.created_at DESC', [orderId, startingDate, endingDate].filter((v) => typeof v == 'string' || typeof v == 'number'));
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
        const [orders] = await pool.execute('SELECT * FROM orders WHERE user_id = ?' + (orderId !== null ? ' AND id = ?' : ' ORDER BY created_at DESC'), orderId ? [userId, orderId] : [userId]);
        return { success: true, orders: orders };
    } catch (error) {
        console.error('Get user orders error:', error);
        throw new DBError(500, 'Failed to fetch user orders');
    }
};

func.cancelOrder = async function (orderId, userId, products) {
    if (!orderId && !userId) {
        throw new DBError(400, 'Order ID and User ID are required');
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
        if (orders[0].user_id !== userId) {
            throw new DBError(403, 'You do not have permission to cancel this order');
        }

        // 2. Update status
        await connection.execute('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);

        // 3. Restore stock
        for (const item of products) {
            await connection.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
            if (item.variant_id) {
                await connection.execute('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [item.quantity, item.variant_id]);
            }
        }
        await connection.commit();
        return { success: true, message: 'Order cancelled' };
    } catch (error) {
        await connection.rollback();
        if (error instanceof DBError) throw error;
        console.error('Cancel order error:', error);
        throw new DBError(500, error.toString());
    } finally {
        connection.release();
    }
};

func.hasUserAlreadyCommented = async function (userId, productId) {
    productId = Number(productId);
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
            SELECT c.*, p.name AS product_name, p.price AS product_price, p.cost AS product_cost, p.discount_rate AS discount_rate, pi.image_url, pv.variant_code AS variant_code, pv.price_add AS variant_price_add, pv.price_mult AS variant_price_mult, pv.cost AS variant_cost
            FROM cart c 
            JOIN products p ON c.product_id = p.id 
            LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
            LEFT JOIN product_variants pv ON c.variant_id = pv.id AND pv.product_id = c.product_id
            WHERE c.user_id = ?
        `, [userId]);
        for (const row of rows) {
            row.product_price = parseFloat(row.product_price);
            row.product_cost = parseFloat(row.product_cost || 0);
            row.discount_rate = parseFloat(row.discount_rate);
            if (row.variant_id) {
                row.variant_price_add = parseFloat(row.variant_price_add);
                row.variant_price_mult = parseFloat(row.variant_price_mult);
                row.variant_price = (Math.round(((row.product_price + (row.variant_price_add || 0)) * (row.variant_price_mult || 1)) * 100) / 100);
                row.variant_cost = parseFloat(row.variant_cost || 0);
                delete row.variant_price_add;
                delete row.variant_price_mult;
            }
            row.final_price = (Math.round(((row.variant_id ? row.variant_price : row.product_price) * ((100 - (row.discount_rate || 0)) / 100)) * 100) / 100);
        }
        return { success: true, cart: rows };
    } catch (error) {
        console.error('Get cart error:', error);
        throw new DBError(500, 'Failed to fetch cart');
    }
}

func.addToCart = async function (userId, productId, quantity = 1, options, variantId = null) {
    if (!userId || !productId) throw new DBError(400, 'User ID and Product ID are required');
    productId = Number(productId);
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

func.getUsersWishingForProduct = async function (productId) {
    if (!productId) throw new DBError(400, 'Product ID is required');
    productId = Number(productId);
    try {
        const [rows] = await pool.execute('SELECT u.id, u.displayname, u.username, u.nameprivacy FROM wishlist w JOIN users u ON w.user_id = u.id WHERE w.product_id = ?', [productId]);
        return { success: true, users: rows };
    } catch (error) {
        console.error('Get users wishing for product error:', error);
        throw new DBError(500, 'Failed to fetch users');
    }
}
func.getNotifyQueue = async function () {
    try {
        const [discount] = await pool.execute('SELECT w.user_id, w.product_id, u.username, u.displayname, u.emailblocked, p.product_code, p.name AS product_name, p.price AS product_price, p.discount_rate, p.stock, c.name AS category_name, pi.image_url FROM wishlist w JOIN users u ON w.user_id = u.id JOIN products p ON w.product_id = p.id JOIN categories c ON p.category_id = c.id LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = 1 WHERE w.is_notified_about_discount = "pending"');
        const [stock] = await pool.execute('SELECT w.user_id, w.product_id, u.username, u.displayname, u.emailblocked, p.product_code, p.name AS product_name, p.price AS product_price, p.discount_rate, p.stock, c.name AS category_name, pi.image_url FROM wishlist w JOIN users u ON w.user_id = u.id JOIN products p ON w.product_id = p.id JOIN categories c ON p.category_id = c.id LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = 1 WHERE w.is_notified_about_stock = "pending"');
        discount.forEach(item => {
            item.product_price = parseFloat(item.product_price);
            item.discount_rate = parseFloat(item.discount_rate);
            item.final_price = (Math.round((item.product_price * ((100 - (item.discount_rate || 0)) / 100)) * 100) / 100);
        });
        stock.forEach(item => {
            item.product_price = parseFloat(item.product_price);
            item.discount_rate = parseFloat(item.discount_rate);
            item.final_price = (Math.round((item.product_price * ((100 - (item.discount_rate || 0)) / 100)) * 100) / 100);
        });
        return { success: true, discount: discount, stock: stock };
    } catch (error) {
        console.error('Get notify queue error:', error);
        throw new DBError(500, 'Failed to fetch notify queue');
    }
}
func.setNotified = async function (userId, type, setToWaiting = false) {
    if (!userId || !type) throw new DBError(400, 'User ID, Product ID and type are required');
    try {
        let field = null;
        if (type === 'discount') field = 'is_notified_about_discount';
        else if (type === 'stock') field = 'is_notified_about_stock';
        else throw new DBError(400, 'Invalid notification type');
        const [result] = await pool.execute(`UPDATE wishlist SET ${field} = ? WHERE user_id = ?`, [setToWaiting ? "waiting" : "notified", userId]);
        return { success: true, message: 'Notification status updated', affectedRows: result.affectedRows };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Set notified error:', error);
        throw new DBError(500, 'Failed to update notification status');
    }
}
func.getWishlists = async function (userId) {
    if (!userId) throw new DBError(400, 'User ID is required');
    try {
        const [rows] = await pool.execute(`
            SELECT w.*, p.name AS product_name, p.price AS product_price, p.discount_rate AS discount_rate, pi.image_url 
            FROM wishlist w 
            JOIN products p ON w.product_id = p.id 
            LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
            WHERE w.user_id = ?
        `, [userId]);
        return { success: true, wishlist: rows };
    } catch (error) {
        console.error('Get wishlists error:', error);
        throw new DBError(500, 'Failed to fetch wishlists');
    }
}

func.addToWishlist = async function (userId, productId) {
    if (!userId || !productId) throw new DBError(400, 'User ID and Product ID are required');
    productId = Number(productId);
    try {
        const [result] = await pool.execute(
            'INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)',
            [userId, productId]
        );
        if (result.affectedRows === 0) {
            return { success: true, message: 'Product is already in wishlist' };
        }
        return { success: true, message: 'Product added to wishlist' };
    } catch (error) {
        console.error('Add to wishlist error:', error);
        throw new DBError(500, 'Failed to add to wishlist');
    }
}

func.removeFromWishlist = async function (userId, productId) {
    if (!userId || !productId) throw new DBError(400, 'User ID and Product ID are required');
    productId = Number(productId);
    try {
        const [result] = await pool.execute('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [userId, productId]);
        if (result.affectedRows === 0) throw new DBError(404, 'Product not found in wishlist');
        return { success: true, message: 'Product removed from wishlist' };
    } catch (error) {
        if (error instanceof DBError) throw error;
        console.error('Remove from wishlist error:', error);
        throw new DBError(500, 'Failed to remove from wishlist');
    }
}

func.getAnalyticsData = async function (startDate = null, endDate = null) {
    try {
        let query = 'SELECT o.*, u.displayname AS customer_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.status != ?';
        const params = ['cancelled'];

        if (startDate) {
            query += ' AND o.created_at >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND o.created_at <= ?';
            params.push(endDate);
        }
        query += ' ORDER BY o.created_at ASC';

        const [orders] = await pool.execute(query, params);

        // Fetch fallback cost map
        const [allProducts] = await pool.query('SELECT id, cost FROM products');
        const [allVariants] = await pool.query('SELECT id, cost FROM product_variants');

        const productCostMap = {};
        for (const p of allProducts) {
            productCostMap[p.id] = parseFloat(p.cost || 0);
        }

        const variantCostMap = {};
        for (const v of allVariants) {
            variantCostMap[v.id] = parseFloat(v.cost || 0);
        }

        const dailyData = {};
        let totalSales = 0;
        let totalCost = 0;
        let totalRefunds = 0;

        const aes = require('../Backend/components/aes256.js');

        for (const ordr of orders) {
            let details = null;
            try {
                let parsedDetails = ordr.details;
                if (typeof parsedDetails === 'string') {
                    parsedDetails = aes.pjs(parsedDetails);
                }
                if (parsedDetails && !parsedDetails.e) {
                    const decrypted = aes.decrypt(parsedDetails, ordr.user_id);
                    if (decrypted.s) {
                        details = aes.pjs(decrypted.value);
                    }
                }
            } catch (err) {
                console.error("Analytics decryption error for order:", ordr.id, err);
            }

            if (!details || !details.products) continue;

            const orderDateStr = new Date(ordr.created_at).toISOString().split('T')[0];
            if (!dailyData[orderDateStr]) {
                dailyData[orderDateStr] = { date: orderDateStr, sales: 0, cost: 0, profit: 0, refunds: 0 };
            }

            for (const item of details.products) {
                const productId = item.product_id || item.id;
                const variantId = item.variant_id;
                const qty = parseInt(item.quantity || 1);
                const price = parseFloat(item.product_price || item.price || 0);
                const deduction = parseFloat(item.pricededuction || 0);

                const itemSales = (price * qty) - deduction;
                
                // Resolve cost
                let unitCost = parseFloat(item.product_cost || item.variant_cost || item.cost || 0);
                if (unitCost === 0) {
                    if (variantId && variantCostMap[variantId] !== undefined) {
                        unitCost = variantCostMap[variantId];
                    } else if (productId && productCostMap[productId] !== undefined) {
                        unitCost = productCostMap[productId];
                    }
                }
                const itemCost = unitCost * qty;

                let itemRefund = 0;
                if (item.refunded) {
                    itemRefund = itemSales; // Refunded full amount of the sale
                }

                dailyData[orderDateStr].sales += itemSales;
                dailyData[orderDateStr].cost += itemCost;
                dailyData[orderDateStr].refunds += itemRefund;
                dailyData[orderDateStr].profit += (itemSales - itemCost - itemRefund);

                totalSales += itemSales;
                totalCost += itemCost;
                totalRefunds += itemRefund;
            }
        }

        // Convert dailyData map to sorted array
        const timeseries = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

        return {
            success: true,
            summary: {
                totalSales: Math.round(totalSales * 100) / 100,
                totalCost: Math.round(totalCost * 100) / 100,
                totalRefunds: Math.round(totalRefunds * 100) / 100,
                netProfit: Math.round((totalSales - totalCost - totalRefunds) * 100) / 100
            },
            timeseries: timeseries
        };
    } catch (error) {
        console.error('Get analytics data error:', error);
        throw new DBError(500, 'Failed to calculate analytics: ' + error.message);
    }
}

module.exports = {
    DBError,
    ...func
};

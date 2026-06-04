const readline = require('readline');
const fetch = require('node-fetch');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const API_URL = 'http://localhost:3000';
let sessionToken = null;
let currentUser = null;

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function apiFetch(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (sessionToken) {
        options.headers['Authorization'] = sessionToken;
    }
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(`${API_URL}/api/${endpoint}`, options);
        const data = await res.json();
        return { ok: res.ok, data, status: res.status };
    } catch (err) {
        return { ok: false, data: { e: err.message } };
    }
}

// --- Auth & Profile ---

async function register() {
    console.log('\n--- Register ---');
    const u = await question('Email/Username: ');
    const n = await question('Display Name: ');
    const p = await question('Password: ');
    const res = await apiFetch('auth/register', 'POST', { u, p, n });
    if (res.ok) console.log('\x1b[32m%s\x1b[0m', 'Success: ' + res.data.m);
    else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
}

async function login() {
    console.log('\n--- Login ---');
    const u = await question('Email/Username: ');
    const p = await question('Password: ');
    const res = await apiFetch('auth/login', 'POST', { u, p });
    if (res.ok) {
        sessionToken = res.data.token;
        console.log('\x1b[32m%s\x1b[0m', 'Logged in successfully!');
        const me = await apiFetch('users/me');
        if (me.ok) currentUser = me.data.user;
    } else {
        console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
    }
}

// --- Products Menu ---

async function manageVariantsMenu() {
    if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
        console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
        return;
    }
    while (true) {
        console.log('\n--- Manage Variants ---');
        console.log('1. Add Variant');
        console.log('2. Update Variant');
        console.log('3. Delete Variant');
        console.log('4. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const product_id = parseInt(await question('Product ID: '));
            if (isNaN(product_id)) {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid Product ID.');
                continue;
            }
            const price_add = parseFloat(await question('Price Add (extra price, e.g. 10.00): ')) || 0.00;
            const price_mult = parseFloat(await question('Price Multiplier (e.g. 1.0): ')) || 1.0000;
            const cost = parseFloat(await question('Cost (e.g. 5.00): ')) || 0.00;
            const stock = parseInt(await question('Stock: ')) || 0;
            const discount_rate = parseFloat(await question('Discount Rate (%): ')) || 0.00;
            
            const option_value_ids_str = await question('Option Value IDs (comma-separated, e.g. 1,2 or enter to skip): ');
            const option_value_ids = option_value_ids_str.trim() 
                ? option_value_ids_str.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x))
                : [];
            
            const variantData = {
                product_id,
                price_add,
                price_mult,
                cost,
                stock,
                discount_rate,
                option_value_ids
            };
            
            const res = await apiFetch('products/variants', 'POST', variantData);
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', `Variant created successfully! ID: ${res.data.variantId}`);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '2') {
            const id = parseInt(await question('Variant ID to update: '));
            if (isNaN(id)) {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid Variant ID.');
                continue;
            }
            console.log('Leave field empty to keep current value.');
            const price_add_input = await question('New Price Add: ');
            const price_mult_input = await question('New Price Multiplier: ');
            const cost_input = await question('New Cost: ');
            const stock_input = await question('New Stock: ');
            const discount_rate_input = await question('New Discount Rate (%): ');
            const option_value_ids_str = await question('New Option Value IDs (comma-separated, enter to keep current): ');

            const edits = {};
            if (price_add_input.trim()) edits.price_add = parseFloat(price_add_input);
            if (price_mult_input.trim()) edits.price_mult = parseFloat(price_mult_input);
            if (cost_input.trim()) edits.cost = parseFloat(cost_input);
            if (stock_input.trim()) edits.stock = parseInt(stock_input);
            if (discount_rate_input.trim()) edits.discount_rate = parseFloat(discount_rate_input);
            if (option_value_ids_str.trim()) {
                edits.option_value_ids = option_value_ids_str.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
            }

            const res = await apiFetch('products/variants', 'PATCH', { id, edits });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', 'Variant updated successfully!');
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '3') {
            const id = parseInt(await question('Variant ID to delete: '));
            if (isNaN(id)) {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid Variant ID.');
                continue;
            }
            const res = await apiFetch('products/variants', 'DELETE', { id });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', 'Variant deleted successfully!');
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '4') {
            break;
        }
    }
}

async function productsMenu() {
    while (true) {
        console.log('\n--- Products ---');
        console.log('1. List All Products');
        console.log('2. Search Products');
        console.log('3. View Product Details');
        console.log('4. Add Product (Admin/Manager)');
        console.log('5. View Brew Methods');
        console.log('6. Manage Discounts (Admin/Manager)');
        console.log('7. Manage Images (Admin/Manager)');
        console.log('8. Manage Variants (Admin/Manager)');
        console.log('9. Delete Product (Admin/Manager)');
        console.log('10. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const res = await apiFetch('products/all');
            if (res.ok) {
                res.data.products.forEach(p => {
                    let priceStr = `${p.price} TL`;
                    if (p.discount_rate > 0) {
                        priceStr = `\x1b[90m\x1b[9m${p.price} TL\x1b[0m \x1b[32m${p.discounted_price.toFixed(2)} TL (-%${p.discount_rate})\x1b[0m`;
                    }
                    console.log(`[${p.id}] ${p.name} - ${priceStr} (Stock: ${p.stock}) ${p.has_variants ? ' (Has Variants)' : ''}`);
                });
            } else {
                console.log('Error fetching products:', res.data);
            }
        } else if (choice === '2') {
            const q = await question('Search query: ');
            const sort = await question('Sort by (newest, oldest, price_asc, price_desc): ');
            const res = await apiFetch(`products/search?q=${q}&s=${sort}`);
            if (res.ok) {
                res.data.products.forEach(p => console.log(`[${p.id}] ${p.name} - ${p.price} TL ${p.has_variants ? ' (Has Variants)' : ''}`));
            }
        } else if (choice === '3') {
            const id = await question('Product ID: ');
            const res = await apiFetch(`products?ids=${id}`);
            if (res.ok && res.data.products.length > 0) console.log(JSON.stringify(res.data.products[0], null, 2));
            else console.log('Product not found or error:', res.data);
        } else if (choice === '4') {
            if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
                console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
                continue;
            }
            console.log('\n--- Add Product ---');
            const name = await question('Product Name (Required): ');
            if (!name.trim()) {
                console.log('\x1b[31m%s\x1b[0m', 'Product Name is required.');
                continue;
            }
            const model = await question('Model (Required): ');
            if (!model.trim()) {
                console.log('\x1b[31m%s\x1b[0m', 'Model is required.');
                continue;
            }
            const serial_number = await question('Serial Number (Required): ');
            if (!serial_number.trim()) {
                console.log('\x1b[31m%s\x1b[0m', 'Serial Number is required.');
                continue;
            }
            const priceInput = await question('Price (Required): ');
            const price = parseFloat(priceInput);
            if (isNaN(price)) {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid price.');
                continue;
            }
            const description = await question('Description: ');
            if (!description.trim()) {
                console.log('\x1b[31m%s\x1b[0m', 'Description is required.');
                continue;
            }
            const costInput = await question('Cost (Default 0): ');
            const cost = parseFloat(costInput) || 0;
            const stockInput = await question('Stock (Required): ');
            const stock = parseInt(stockInput);
            if (isNaN(stock) || stock < 0) {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid stock.');
                continue;
            }
            const hasVariants = (await question('Has Variants? (y/n): ')).toLowerCase() === 'y';
            const categoryIdInput = await question('Category ID (optional, Enter to skip): ');
            const category_id = categoryIdInput.trim() ? parseInt(categoryIdInput) : null;
            const weightInput = await question('Weight (optional, Enter to skip): ');
            const weight = weightInput.trim() ? parseFloat(weightInput) : null;
            const taxInput = await question('Tax (Default 0): ');
            const tax = taxInput.trim() ? parseFloat(taxInput) : 0;
            const origin = await question('Origin: ');
            const roast_level = await question('Roast Level: ');
            const acidity = await question('Acidity: ');
            const flavor_notes = await question('Flavor Notes: ');
            const material = await question('Material: ');
            const capacity = await question('Capacity: ');
            const image_url = await question('Primary Image URL: ');
            const discountRateInput = await question('Discount Rate (%): ');
            const discount_rate = discountRateInput.trim() ? parseFloat(discountRateInput) : 0;
            const warranty_status = await question('Warranty Status (Required): ');
            if (!warranty_status.trim()) {
                console.log('\x1b[31m%s\x1b[0m', 'Warranty Status is required.');
                continue;
            }
            const distributor_information = await question('Distributor Information (Required): ');
            if (!distributor_information.trim()) {
                console.log('\x1b[31m%s\x1b[0m', 'Distributor Information is required.');
                continue;
            }

            const productData = {
                name,
                model: model.trim(),
                serial_number: serial_number.trim(),
                price,
                description: description.trim(),
                cost,
                stock,
                has_variants: hasVariants,
                category_id,
                weight,
                tax,
                origin: origin.trim() || null,
                roast_level: roast_level.trim() || null,
                acidity: acidity.trim() || null,
                flavor_notes: flavor_notes.trim() || null,
                material: material.trim() || null,
                capacity: capacity.trim() || null,
                image_url: image_url.trim() || null,
                discount_rate,
                warranty_status: warranty_status.trim(),
                distributor_information: distributor_information.trim()
            };

            const res = await apiFetch('products', 'POST', productData);
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', `Product created successfully! ID: ${res.data.productId}`);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '5') {
            const res = await apiFetch('products/brew-methods');
            if (res.ok) {
                res.data.brew_methods.forEach(b => console.log(`[${b.id}] ${b.name}: ${b.description}`));
            }
        } else if (choice === '6') {
            if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
                console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
                continue;
            }
            console.log('\n--- Manage Discounts ---');
            const id = await question('Product ID: ');
            const rate = await question('Discount Rate (%): ');
            const res = await apiFetch('products/discount', 'PATCH', { id: parseInt(id), rate: parseFloat(rate) });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '7') {
            if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
                console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
                continue;
            }
            console.log('\n--- Manage Images ---');
            console.log('1. Add Image');
            console.log('2. Remove Image');
            const sub = await question('Select: ');
            if (sub === '1') {
                const productId = await question('Product ID: ');
                const url = await question('Image URL: ');
                const isPrimary = await question('Is Primary? (y/n): ') === 'y';
                const sortOrder = await question('Sort Order: ');
                const res = await apiFetch('products/image', 'POST', { productId: parseInt(productId), url, isPrimary, sortOrder: parseInt(sortOrder) });
                if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
                else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
            } else if (sub === '2') {
                const id = await question('Image ID to remove: ');
                const res = await apiFetch(`products/image?id=${id}`, 'DELETE');
                if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
                else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
            }
        } else if (choice === '8') {
            await manageVariantsMenu();
        } else if (choice === '9') {
            if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
                console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
                continue;
            }
            console.log('\n--- Delete Product ---');
            const id = await question('Product ID to delete: ');
            const res = await apiFetch('products', 'DELETE', { id: parseInt(id) });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '10') break;
    }
}

// --- Orders Menu ---

async function ordersMenu() {
    if (!sessionToken) {
        console.log('\x1b[31m%s\x1b[0m', 'Please login first.');
        return;
    }
    while (true) {
        console.log('\n--- Orders & Refunds ---');
        console.log('1. View My Order History');
        console.log('2. Place New Order');
        console.log('3. Cancel Order');
        console.log('4. Request Refund');
        console.log('5. Approve Refund (Sales Manager)');
        console.log('6. Update Order Status (Admin/Distributor)');
        console.log('7. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const res = await apiFetch('orders/me');
            if (res.ok) {
                res.data.orders.forEach(o => {
                    console.log(`Order #${o.id} | Result: ${o.total_price} | Status: ${o.status} | Date: ${o.created_at}`);
                });
            }
        } else if (choice === '2') {
            const items = [];
            while (true) {
                const productId = await question('Product ID (or "done"): ');
                if (productId === 'done') break;
                const quantity = await question('Quantity: ');
                const price = await question('Price at purchase: ');
                items.push({ productId: parseInt(productId), quantity: parseInt(quantity), price: parseFloat(price) });
            }
            if (items.length > 0) {
                const res = await apiFetch('orders', 'POST', { items });
                if (res.ok) console.log('\x1b[32m%s\x1b[0m', `Order created! ID: ${res.data.orderId}`);
                else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
            }
        } else if (choice === '3') {
            const orderId = await question('Order ID to cancel: ');
            const res = await apiFetch('orders/cancel', 'PATCH', { orderId });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.m);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '4') {
            const orderId = await question('Order ID: ');
            const productId = await question('Product ID: ');
            const res = await apiFetch('refunds', 'POST', { orderId, productId });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', `Refund requested! ID: ${res.data.refundId}`);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '5') {
            const refundId = await question('Refund ID to approve: ');
            const res = await apiFetch('refunds/approve', 'PATCH', { refundId });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.m);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '6') {
            const orderId = await question('Order ID: ');
            const status = await question('New Status (processing, in-transit, delivered): ');
            const res = await apiFetch('orders/status', 'PATCH', { orderId, status });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.m);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '7') break;
    }
}

// --- Comments Menu ---

async function commentsMenu() {
    while (true) {
        console.log('\n--- Comments ---');
        console.log('1. View Comments for a Product');
        console.log('2. Add Comment');
        console.log('3. Approve/Reject Comments (Staff)');
        console.log('4. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const pid = await question('Product ID: ');
            const res = await apiFetch(`comments/product/${pid}`);
            if (res.ok) {
                res.data.comments.forEach(c => {
                    console.log(`[★${c.rating}] ${c.displayname}: ${c.comment_text}`);
                });
            }
        } else if (choice === '2') {
            if (!sessionToken) { console.log('Login required.'); break; }
            const productId = await question('Product ID: ');
            const text = await question('Comment: ');
            const rating = await question('Rating (1-5): ');
            const res = await apiFetch('comments', 'POST', { productId, text, rating });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', 'Comment submitted for approval!');
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '3') {
            const commentId = await question('Comment ID: ');
            const action = await question('Action (approve/reject): ');
            const res = await apiFetch(`comments/${action}`, 'PATCH', { commentId });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.m);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '4') break;
    }
}

// --- Admin Menu ---

async function manageCategoriesMenu() {
    while (true) {
        console.log('\n--- Manage Categories ---');
        console.log('1. List Categories');
        console.log('2. Add Category (Admin/Manager)');
        console.log('3. Update Category (Admin/Manager)');
        console.log('4. Delete Category (Admin/Manager)');
        console.log('5. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const parentInput = await question('Parent Category ID (optional, Enter for root): ');
            const endpoint = parentInput.trim() ? `products/categories/${parentInput.trim()}` : 'products/categories';
            const res = await apiFetch(endpoint, 'GET');
            if (res.ok) {
                console.log('\n--- Categories ---');
                res.data.categories.forEach(c => {
                    console.log(`[ID: ${c.id}] ${c.name} ${c.parent_id ? `(Parent ID: ${c.parent_id})` : '(Root)'}`);
                });
                if (res.data.products && res.data.products.length > 0) {
                    console.log('\n--- Products in Category ---');
                    res.data.products.forEach(p => {
                        console.log(`[ID: ${p.id}] ${p.name} - ${p.price} TL`);
                    });
                }
            } else {
                console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
            }
        } else if (choice === '2') {
            if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
                console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
                continue;
            }
            const name = await question('Category Name: ');
            if (!name.trim()) {
                console.log('\x1b[31m%s\x1b[0m', 'Name is required.');
                continue;
            }
            const parentInput = await question('Parent Category ID (optional, Enter for root): ');
            const parent_id = parentInput.trim() ? parseInt(parentInput) : null;
            const res = await apiFetch('products/categories', 'POST', { name, parent_id });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', `Category created! ID: ${res.data.categoryId}`);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '3') {
            if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
                console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
                continue;
            }
            const id = parseInt(await question('Category ID to update: '));
            if (isNaN(id)) {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid ID.');
                continue;
            }
            const name = await question('New Category Name (optional, Enter to skip): ');
            const parentInput = await question('New Parent ID (optional, Enter to skip): ');
            const edits = {};
            if (name.trim()) edits.name = name;
            if (parentInput.trim()) edits.parent_id = parseInt(parentInput);

            const res = await apiFetch('products/categories', 'PATCH', { id, edits });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', 'Category updated successfully!');
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '4') {
            if (!currentUser || !["Admin", "Product Manager"].includes(currentUser.role)) {
                console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
                continue;
            }
            const id = parseInt(await question('Category ID to delete: '));
            if (isNaN(id)) {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid ID.');
                continue;
            }
            const res = await apiFetch('products/categories', 'DELETE', { id });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', 'Category deleted successfully!');
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '5') {
            break;
        }
    }
}

async function viewAnalytics() {
    if (!currentUser || !["Admin", "Product Manager", "Sales Manager"].includes(currentUser.role)) {
        console.log('\x1b[31m%s\x1b[0m', 'Unauthorized.');
        return;
    }
    console.log('\n--- View Analytics ---');
    const startDate = await question('Start Date (YYYY-MM-DD, optional): ');
    const endDate = await question('End Date (YYYY-MM-DD, optional): ');

    let endpoint = 'analytics';
    const params = [];
    if (startDate.trim()) params.push(`startDate=${startDate.trim()}`);
    if (endDate.trim()) params.push(`endDate=${endDate.trim()}`);
    if (params.length > 0) endpoint += `?${params.join('&')}`;

    const res = await apiFetch(endpoint, 'GET');
    if (res.ok) {
        const { summary, timeseries } = res.data;
        const totalSalesStr = (summary.totalSales || 0).toFixed(2) + ' TL';
        const totalCostStr = (summary.totalCost || 0).toFixed(2) + ' TL';
        const totalRefundsStr = (summary.totalRefunds || 0).toFixed(2) + ' TL';
        const netProfit = summary.netProfit || 0;
        const netProfitStr = netProfit.toFixed(2) + ' TL';
        
        const profitColor = netProfit >= 0 ? '\x1b[32m' : '\x1b[31m';

        console.log('\n┌────────────────────────────────────────────────────────┐');
        console.log('│' + '\x1b[36m' + '               AURORA COFFEE SALES ANALYTICS            ' + '\x1b[0m│');
        console.log('├────────────────────────────────────────────────────────┤');
        console.log('│  Total Sales:   ' + totalSalesStr.padEnd(38) + ' │');
        console.log('│  Total Cost:    ' + totalCostStr.padEnd(38) + ' │');
        console.log('│  Total Refunds: ' + totalRefundsStr.padEnd(38) + ' │');
        console.log('│  Net Profit:    ' + `${profitColor}${netProfitStr.padEnd(38)}\x1b[0m │`);
        console.log('└────────────────────────────────────────────────────────┘');

        if (timeseries && timeseries.length > 0) {
            console.log('\n--- Timeseries Data ---');
            console.log('Date        │ Sales (TL) │ Cost (TL)  │ Refunds (TL) │ Net Profit (TL)');
            console.log('────────────┼────────────┼────────────┼──────────────┼────────────────');
            timeseries.forEach(t => {
                const date = t.date ? t.date.substring(0, 10) : 'N/A';
                const sVal = (t.sales || 0).toFixed(2);
                const cVal = (t.cost || 0).toFixed(2);
                const rVal = (t.refunds || 0).toFixed(2);
                const pVal = (t.profit || 0).toFixed(2);
                const pColor = t.profit >= 0 ? '\x1b[32m' : '\x1b[31m';
                console.log(`${date.padEnd(11)}│ ${sVal.padEnd(10)} │ ${cVal.padEnd(10)} │ ${rVal.padEnd(12)} │ ${pColor}${pVal.padEnd(14)}\x1b[0m`);
            });
        } else {
            console.log('No timeseries data available for this range.');
        }
    } else {
        console.log('\x1b[31m%s\x1b[0m', 'Error: ' + (res.data.e || 'Failed to fetch analytics'));
    }
}

async function adminMenu() {
    while (true) {
        console.log('\n--- Administrative ---');
        console.log('1. Change User Role');
        console.log('2. Manage Categories');
        console.log('3. View Analytics');
        console.log('4. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const userId = await question('User ID: ');
            const role = await question('New Role (Customer, Product Manager, Sales Manager): ');
            const res = await apiFetch('users/role', 'PATCH', { userId, role });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.m);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '2') {
            await manageCategoriesMenu();
        } else if (choice === '3') {
            await viewAnalytics();
        } else if (choice === '4') break;
    }
}

// --- Cart Menu ---

async function cartMenu() {
    if (!sessionToken) { console.log('\x1b[31m%s\x1b[0m', 'Please login first.'); return; }
    while (true) {
        console.log('\n--- Cart ---');
        console.log('1. View Cart');
        console.log('2. Add Item to Cart');
        console.log('3. Modify Cart Item Quantity');
        console.log('4. Delete Cart Item');
        console.log('5. Clear Cart');
        console.log('6. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const res = await apiFetch('cart');
            if (res.ok) console.log(JSON.stringify(res.data.cart, null, 2));
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '2') {
            const productId = await question('Product ID: ');
            const quantity = await question('Quantity: ');
            const variantIdInput = await question('Variant ID (optional, press Enter to skip): ');
            const optionsInput = await question('Options (optional JSON, press Enter to skip): ');
            
            const reqBody = { id: parseInt(productId), qty: parseInt(quantity) };
            if (variantIdInput.trim()) reqBody.variantId = parseInt(variantIdInput);
            if (optionsInput.trim()) {
                try {
                    reqBody.opt = JSON.parse(optionsInput);
                } catch(e) {
                    reqBody.opt = optionsInput; // pass as string if not parseable
                }
            }
            
            const res = await apiFetch('cart', 'POST', reqBody);
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '3') {
            const itemId = await question('Cart Item ID: ');
            const quantity = await question('New Quantity: ');
            const res = await apiFetch('cart', 'PATCH', { itemId: parseInt(itemId), quantity: parseInt(quantity) });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '4') {
            const itemId = await question('Cart Item ID: ');
            const res = await apiFetch(`cart?item=${itemId}`, 'DELETE');
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '5') {
            const res = await apiFetch('cart?clear=true', 'DELETE');
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '6') break;
    }
}

// --- Address Menu ---

async function addressMenu() {
    if (!sessionToken) { console.log('\x1b[31m%s\x1b[0m', 'Please login first.'); return; }
    while (true) {
        console.log('\n--- Addresses ---');
        console.log('1. View Addresses');
        console.log('2. Add Address');
        console.log('3. Update Address');
        console.log('4. Delete Address');
        console.log('5. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const res = await apiFetch('address');
            if (res.ok) console.log(JSON.stringify(res.data.addresses, null, 2));
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '2') {
            const address = {
                alias: await question('Alias (Title): '),
                name: await question('First Name: '),
                surname: await question('Last Name: '),
                phone: await question('Phone: '),
                country: await question('Country: ') || 'Turkey',
                province: await question('Province/State: '),
                city: await question('City: '),
                zip: await question('ZIP Code: '),
                address: await question('Address Line 1: '),
                address2: await question('Address Line 2 (Optional): ')
            };
            const res = await apiFetch('address', 'POST', { address });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '3') {
            const id = await question('Address ID to update: ');
            const address = {
                alias: await question('Alias (Title): '),
                name: await question('First Name: '),
                surname: await question('Last Name: '),
                phone: await question('Phone: '),
                country: await question('Country: ') || 'Turkey',
                province: await question('Province/State: '),
                city: await question('City: '),
                zip: await question('ZIP Code: '),
                address: await question('Address Line 1: '),
                address2: await question('Address Line 2 (Optional): ')
            };
            const res = await apiFetch('address', 'PATCH', { id: parseInt(id), address });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '4') {
            const id = await question('Address ID to delete: ');
            const res = await apiFetch('address', 'DELETE', { id: parseInt(id) });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '5') break;
    }
}

async function accountSettingsMenu() {
    if (!sessionToken) { console.log('\x1b[31m%s\x1b[0m', 'Please login first.'); return; }
    while (true) {
        console.log('\n--- Account Settings ---');
        console.log('1. View My Profile');
        console.log('2. Delete My Account');
        console.log('3. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            console.log(JSON.stringify(currentUser, null, 2));
        } else if (choice === '2') {
            const confirm = await question('ARE YOU SURE? This cannot be undone. Type "DELETE" to confirm: ');
            if (confirm === 'DELETE') {
                const res = await apiFetch('users/me', 'DELETE');
                if (res.ok) {
                    console.log('\x1b[32m%s\x1b[0m', 'Account deleted. Logging out...');
                    sessionToken = null;
                    currentUser = null;
                    return;
                } else {
                    console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
                }
            }
        } else if (choice === '3') break;
    }
}
async function wishlistMenu() {
    if (!sessionToken) { console.log('\x1b[31m%s\x1b[0m', 'Please login first.'); return; }
    while (true) {
        console.log('\n--- Wishlist ---');
        console.log('1. View Wishlist');
        console.log('2. Add to Wishlist');
        console.log('3. Remove from Wishlist');
        console.log('4. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const res = await apiFetch('wishlist');
            if (res.ok) {
                console.log(JSON.stringify(res.data.wishlist, null, 2));
            } else {
                console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
            }
        } else if (choice === '2') {
            const productId = await question('Product ID: ');
            const res = await apiFetch('wishlist', 'POST', { id: parseInt(productId) });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '3') {
            const productId = await question('Product ID: ');
            const res = await apiFetch(`wishlist?id=${productId}`, 'DELETE');
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.msg);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '4') {
            break;
        } else {
            console.log('Invalid option.');
        }
    }
}

async function mainMenu() {
    console.log('\n' + '='.repeat(30));
    console.log('   AURORA COFFEE TERMINAL   ');
    console.log('='.repeat(30));
    if (currentUser) {
        console.log(`Logged in as: ${currentUser.displayname} (${currentUser.role})`);
    } else {
        console.log('Not logged in.');
    }
    
    console.log('\n1. Register');
    console.log('2. Login');
    console.log('3. Products');
    console.log('4. Orders & Refunds');
    console.log('5. Comments');
    console.log('6. Cart');
    console.log('7. Address Management');
    console.log('8. Account Settings');
    console.log('9. Administrative');
    console.log('10. Wishlist');
    console.log('11. Exit');

    const choice = await question('\nSelect an option: ');

    try {
        switch (choice) {
            case '1': await register(); break;
            case '2': await login(); break;
            case '3': await productsMenu(); break;
            case '4': await ordersMenu(); break;
            case '5': await commentsMenu(); break;
            case '6': await cartMenu(); break;
            case '7': await addressMenu(); break;
            case '8': await accountSettingsMenu(); break;
            case '9': await adminMenu(); break;
            case '10': await wishlistMenu(); break;
            case '11':
                console.log('Goodbye!');
                rl.close();
                process.exit(0);
            default:
                console.log('Invalid option.');
        }
    } catch (err) {
        console.log('\x1b[31m%s\x1b[0m', `Error: ${err.message}`);
    }
    mainMenu();
}

mainMenu();

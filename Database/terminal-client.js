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

async function productsMenu() {
    while (true) {
        console.log('\n--- Products ---');
        console.log('1. List All Products');
        console.log('2. Search Products');
        console.log('3. View Product Details');
        console.log('4. Add Product (Admin/Manager)');
        console.log('5. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const res = await apiFetch('products');
            if (res.ok) {
                res.data.products.forEach(p => console.log(`[${p.id}] ${p.name} - ${p.price} TL (Stock: ${p.stock})`));
            }
        } else if (choice === '2') {
            const q = await question('Search query: ');
            const sort = await question('Sort by (price_asc, price_desc, popularity): ');
            const res = await apiFetch(`products/search?q=${q}&sort=${sort}`);
            if (res.ok) {
                res.data.products.forEach(p => console.log(`[${p.id}] ${p.name} - ${p.price} TL`));
            }
        } else if (choice === '3') {
            const id = await question('Product ID: ');
            const res = await apiFetch(`products/${id}`);
            if (res.ok) console.log(JSON.stringify(res.data.product, null, 2));
        } else if (choice === '4') {
            console.log('Enter product data (JSON format or prompts... let\'s do prompts for simplicity)');
            const name = await question('Name: ');
            const description = await question('Description: ');
            const price = await question('Price: ');
            const stock = await question('Stock: ');
            const category_id = await question('Category ID: ');
            const res = await apiFetch('products', 'POST', { name, description, price, stock, category_id });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', 'Product added!');
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '5') break;
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

async function adminMenu() {
    while (true) {
        console.log('\n--- Administrative ---');
        console.log('1. Change User Role');
        console.log('2. Back');

        const choice = await question('Select: ');
        if (choice === '1') {
            const userId = await question('User ID: ');
            const role = await question('New Role (Customer, Product Manager, Sales Manager): ');
            const res = await apiFetch('users/role', 'PATCH', { userId, role });
            if (res.ok) console.log('\x1b[32m%s\x1b[0m', res.data.m);
            else console.log('\x1b[31m%s\x1b[0m', 'Error: ' + res.data.e);
        } else if (choice === '2') break;
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
    console.log('6. Administrative');
    console.log('7. Exit');

    const choice = await question('\nSelect an option: ');

    try {
        switch (choice) {
            case '1': await register(); break;
            case '2': await login(); break;
            case '3': await productsMenu(); break;
            case '4': await ordersMenu(); break;
            case '5': await commentsMenu(); break;
            case '6': await adminMenu(); break;
            case '7':
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

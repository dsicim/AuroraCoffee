const readline = require('readline');
const fetch = require('node-fetch');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const API_URL = 'http://localhost:3000';

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function register() {
    const username = await question('Enter username: ');
    const password = await question('Enter password: ');

    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
        console.log('\x1b[32m%s\x1b[0m', `Success: ${data.message}`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', `Error: ${data.error}`);
    }
}

async function login() {
    const username = await question('Enter username: ');
    const password = await question('Enter password: ');

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
        console.log('\x1b[32m%s\x1b[0m', `Success: ${data.message} (User ID: ${data.userId})`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', `Error: ${data.error}`);
    }
}

async function checkServer() {
    try {
        await fetch(API_URL, { method: 'HEAD' });
        return true;
    } catch (err) {
        return false;
    }
}

async function mainMenu() {
    const isServerUp = await checkServer();
    if (!isServerUp) {
        console.log('\x1b[31m%s\x1b[0m', 'Error: Server is not running! Please start "node server.js" in another terminal first.');
        process.exit(1);
    }

    console.log('\n--- Terminal Login System ---');
    console.log('1. Register');
    console.log('2. Login');
    console.log('3. Exit');

    const choice = await question('Select an option: ');

    try {
        switch (choice) {
            case '1':
                await register();
                break;
            case '2':
                await login();
                break;
            case '3':
                rl.close();
                process.exit(0);
            default:
                console.log('Invalid option.');
        }
    } catch (err) {
        console.log('\x1b[31m%s\x1b[0m', `Connection error: ${err.message}`);
    }
    mainMenu();
}

mainMenu();

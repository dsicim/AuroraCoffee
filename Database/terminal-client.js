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
    const username = await question('Enter email/username: ');
    const displayname = await question('Enter display name: ');
    const password = await question('Enter password: ');

    const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u: username, p: password, n: displayname })
    });

    const data = await res.json();
    if (res.ok) {
        console.log('\x1b[32m%s\x1b[0m', `Success: ${data.m}`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', `Error: ${data.e}`);
    }
}

async function login() {
    const username = await question('Enter email/username: ');
    const password = await question('Enter password: ');

    const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u: username, p: password })
    });

    const data = await res.json();
    if (res.ok) {
        console.log('\x1b[32m%s\x1b[0m', `Success: Logged in! Token: ${data.token ? data.token.substring(0,10) + '...' : 'N/A'}`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', `Error: ${data.e}`);
    }
}

async function searchUser() {
    const username = await question('Enter username to search: ');

    const res = await fetch(`${API_URL}/api/user/search?u=${username}`);
    const data = await res.json();

    if (res.ok) {
        console.log('\n--- User Information ---');
        console.log(`ID: ${data.id}`);
        console.log(`Display Name: ${data.displayname}`);
        console.log(`Username: ${data.username}`);
        console.log(`Verified: ${data.verified ? 'Yes' : 'No'}`);
        console.log(`Created At: ${data.created_at}`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', `Error: ${data.e}`);
    }
}

async function changePassword() {
    const username = await question('Enter username: ');
    const oldPassword = await question('Enter old password: ');
    const newPassword = await question('Enter new password: ');

    const res = await fetch(`${API_URL}/api/auth/password/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u: username, p: oldPassword, np: newPassword })
    });

    const data = await res.json();
    if (res.ok) {
        console.log('\x1b[32m%s\x1b[0m', `Success: ${data.m}`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', `Error: ${data.e}`);
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
        console.log('\x1b[31m%s\x1b[0m', 'Error: Server is not running! Please start "node main.js" in the Backend folder first.');
        process.exit(1);
    }

    console.log('\n--- Terminal Login System ---');
    console.log('1. Register');
    console.log('2. Login');
    console.log('3. Search User');
    console.log('4. Change Password');
    console.log('5. Exit');

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
                await searchUser();
                break;
            case '4':
                await changePassword();
                break;
            case '5':
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

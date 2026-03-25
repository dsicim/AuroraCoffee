const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = JSON.parse(fs.readFileSync("../Backend/config.json", "utf-8"));

let pool;

const func = {};

func.initDB = async function () {
    try {
        pool = mysql.createPool({
            host: "localhost",
            user: config.user,
            password: config.password,
            database: config.database
        });
        console.log('Connected to MySQL database.');
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
}
func.registerUser = async function (username, password, displayname) {
    if (!username || !password || !displayname) {
        throw new Error({ status: 400, error: 'Username, name and password are required'});
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            'INSERT INTO users (displayname, username, password) VALUES (?, ?, ?)',
            [displayname, username, hashedPassword]
        );
        return { success: true, message: 'User registered successfully', userId: this.lastID };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error({ status: 403, error: 'Username already exists' });
        }
        console.error('Registration error:', error);
        throw new Error({ status: 500, error: 'Internal server error' });
    }
};
func.loginUser = async function (username, password) {
    if (!username || !password) {
        throw new Error({ status: 400, error: 'Username and password are required' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            throw new Error({ status: 401, error: 'Invalid email or password' });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            throw new Error({ status: 401, error: 'Invalid email or password' });
        }

        return { success: true, message: 'Login successful', userId: user.id };
    } catch (error) {
        console.error('Login error:', error);
        throw new Error({ status: 500, error: 'Internal server error' });
    }
};

module.exports = func;
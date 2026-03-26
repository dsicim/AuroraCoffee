const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = JSON.parse(fs.readFileSync("../Backend/config.json", "utf-8"));

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
        throw new DBError(400, 'Username, name and password are required');
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (displayname, username, password, verified) VALUES (?, ?, ?, ?)',
            [displayname, username, hashedPassword, !config.verifyemail]
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
func.findUser = async function (username) {
    if (!username) {
        throw new DBError(400, 'Username is required');
    }
    try {
        const [rows] = await pool.execute(
            'SELECT id, displayname, username, verified, created_at FROM users WHERE username = ?',
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
func.changePassword = async function (username, oldPassword, newPassword) {
    if (!username || !oldPassword || !newPassword) {
        throw new DBError(400, 'Username, old password and new password are required');
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
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            throw new DBError(401, 'Invalid old password');
        }
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

module.exports = { DBError, ...func };
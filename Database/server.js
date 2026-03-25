const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = JSON.parse(fs.readFileSync("../Backend/config.json", "utf-8"));

let pool;

async function initDB() {
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

// Register Endpoint
// app.post('/register', async (req, res) => {
//     const { username, password } = req.body;

//     if (!username || !password) {
//         return res.status(400).json({ error: 'Username and password are required' });
//     }

//     try {
//         const hashedPassword = await bcrypt.hash(password, 10);
//         await pool.execute(
//             'INSERT INTO users (username, password) VALUES (?, ?)',
//             [username, hashedPassword]
//         );
//         res.status(201).json({ message: 'User registered successfully' });
//     } catch (error) {
//         if (error.code === 'ER_DUP_ENTRY') {
//             return res.status(400).json({ error: 'Username already exists' });
//         }
//         console.error('Registration error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

// Login Endpoint
// app.post('/login', async (req, res) => {
//     const { username, password } = req.body;

//     if (!username || !password) {
//         return res.status(400).json({ error: 'Username and password are required' });
//     }

//     try {
//         const [rows] = await pool.execute(
//             'SELECT * FROM users WHERE username = ?',
//             [username]
//         );

//         if (rows.length === 0) {
//             return res.status(401).json({ error: 'Invalid username or password' });
//         }

//         const user = rows[0];
//         const isMatch = await bcrypt.compare(password, user.password);

//         if (!isMatch) {
//             return res.status(401).json({ error: 'Invalid username or password' });
//         }

//         res.json({ message: 'Login successful', userId: user.id });
//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

module.exports = { initDB, server };
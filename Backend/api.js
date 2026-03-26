const sql = require("../Database/server.js");
const crypto = require('crypto');
const tokens = new Map(); // token: { token, userId, expires }
async function generateToken() {
    let token = crypto.randomBytes(128).toString('base64').substring(0,64);
    while (tokens.has(token)) {
        token = crypto.randomBytes(128).toString('base64').substring(0,64);
    }
    return token;
}
const emailsrv = require("./email.js");
async function handleAPI(method, endpoint, query, body, headers) {
    console.log("API "+method+" ");
    console.log(endpoint);
    console.log(query);
    console.log(body);
    if (endpoint[0] === "version") {
        return {s:200, j:false, d:"0.1.20"};
    }
    else if (endpoint[0] === "auth") {
        endpoint.shift();
        if (endpoint[0] === "login") {
            if (method === "POST") { // Login
                if (body && body.exists && body.json && !body.err && body.data.u && body.data.p) {
                    const email = body.data.u;
                    const password = body.data.p;
                    return await sql.loginUser(email, password).then(async result => {
                        if (result.success) {
                            const token = await generateToken();
                            const expires = new Date().getTime() + 3600000;
                            tokens.set(token, { id: result.userId, expires: expires });
                            return { s: 200, j: true, d: { token: token, expires: expires } };
                        }
                        else {
                            return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                        }
                    }).catch(err => {
                        console.error("Login error:", err);
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else return {s:400, j:true, d:{e:"Invalid Request"}};
            }
            else return {s:405, j:true, d:{e:"Method Not Allowed"}};
        }
        else if (endpoint[0] === "register") {
            if (method === "POST") { // Register
                if (body && body.exists && body.json && !body.err && body.data.u && body.data.p && body.data.n) {
                    const email = body.data.u;
                    const password = body.data.p;
                    const displayname = body.data.n;
                    return await sql.registerUser(email, password, displayname).then(async result => {
                        if (result.success) {
                            // const token = await generateToken();
                            // const expires = new Date().getTime() + 3600000;
                            // tokens.set(token, { id: result.userId, expires: expires });
                            return { s: 200, j: true, d: { m: "User registered successfully" } };
                        }
                        else {
                            return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                        }
                    }).catch(err => {
                        console.error("Register error:", err);
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else return {s:400, j:true, d:{e:"Invalid Request"}};
            }
            else if (method === "PATCH") { // Verify email
                if (body && body.exists && body.json && !body.err && body.data.t) {
                    const token = body.data.t;
                    return {s:500, j:true, d:{e:"Not implemented"}};
                }
                else return {s:400, j:true, d:{e:"Invalid Request"}};
            }
            else return {s:405, j:true, d:{e:"Method Not Allowed"}};
        }
        else if (endpoint[0] === "password") {
            if (method === "POST") { // Change password token request
                if (body && body.exists && body.json && !body.err && body.data.u) {
                    const email = body.data.u;
                    return {s:500, j:true, d:{e:"Not implemented"}};
                }
                else return {s:400, j:true, d:{e:"Invalid Request"}};
            }
            else if (method === "PATCH") { // Change password
                if (body && body.exists && body.json && !body.err && body.data.t && body.data.p) {
                    const token = body.data.t;
                    const password = body.data.p;
                    return {s:500, j:true, d:{e:"Not implemented"}};
                }
                else return {s:400, j:true, d:{e:"Invalid Request"}};
            }
            else return {s:405, j:true, d:{e:"Method Not Allowed"}};
        }
    }
    return {s:400, j:true, d:{e:"Not Found"}};
}
module.exports = { handleAPI, initDB: sql.initDB };
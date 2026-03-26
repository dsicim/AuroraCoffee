const sql = require("../Database/server.js");
const fs = require("fs");
const crypto = require('crypto');
const tokens = new Map();
const emailtokens = new Map();
const emailids = new Map();
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
async function generateToken(email = false) {
    let token = crypto.randomBytes(email ? 256 : 128).toString('base64').substring(0, email ? 128 : 64);
    token = token.replaceAll('+', '!').replaceAll('/', '_').replaceAll('=', '-');
    while (email ? emailtokens.has(token) : tokens.has(token)) {
        token = crypto.randomBytes(email ? 256 : 128).toString('base64').substring(0, email ? 128 : 64);
        token = token.replaceAll('+', '!').replaceAll('/', '_').replaceAll('=', '-');
    }
    return token;
}
const emailsrv = require("./email.js");
async function handleAPI(method, endpoint, query, body, headers) {
    console.log("API " + method + " ");
    console.log(endpoint);
    console.log(query);
    console.log(body);
    if (endpoint[0] === "version") {
        return { s: 200, j: false, d: "0.1.20" };
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
                            if (result.message == "User unverified") {
                                let emailvalid = false;
                                if (emailids.has(result.userId + "-register") && emailtokens.has(emailids.get(result.userId + "-register"))) {
                                    if (emailtokens.get(emailids.get(result.userId + "-register")).expires > new Date().getTime()) {
                                        emailvalid = true;
                                    }
                                    else {
                                        emailtokens.delete(emailids.get(result.userId + "-register"));
                                        emailids.delete(result.userId + "-register");
                                    }
                                }
                                if (!emailvalid) {
                                    const emailToken = await generateToken(true);
                                    const emailExpires = new Date().getTime() + 14400000;
                                    return await emailsrv.sendEmail(email, "Complete your registration", fs.readFileSync("./verifyemail.html", "utf-8").replaceAll("{token}", config.domain + "/api/verify?purpose=register&token=" + emailToken)).then(res => {
                                        console.log("Email sent:", res);
                                        emailids.set(result.userId + "-register", emailToken);
                                        emailtokens.set(emailToken, { id: result.userId, expires: emailExpires, for: "register" });
                                        return { s: 403, j: true, d: { e: "Email not verified. We've re-sent the verification email." } };
                                    }).catch(err => {
                                        console.error("Email sending error:", err);
                                        return { s: 500, j: true, d: { e: "Internal server error. Please check the email service" } };
                                    });
                                }
                                else return { s: 403, j: true, d: { e: "Email not verified. Please verify your email before logging in." } };
                            }
                            else return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                        }
                    }).catch(err => {
                        console.error("Login error:", err);
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else return { s: 400, j: true, d: { e: "Invalid Request" } };
            }
            else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
        else if (endpoint[0] === "register") {
            if (method === "POST") { // Register
                if (body && body.exists && body.json && !body.err && body.data.u && body.data.p && body.data.n) {
                    const email = body.data.u;
                    const password = body.data.p;
                    const displayname = body.data.n;
                    return await sql.registerUser(email, password, displayname).then(async result => {
                        if (result.success) {
                            result.userId;
                            if (config.verifyemail) {
                                const emailToken = await generateToken(true);
                                const emailExpires = new Date().getTime() + 14400000;
                                return await emailsrv.sendEmail(email, "Complete your registration", fs.readFileSync("./verifyemail.html", "utf-8").replaceAll("{token}", config.domain + "/api/verify?purpose=register&token=" + emailToken)).then(res => {
                                    console.log("Email sent:", res);
                                    emailids.set(result.userId + "-register", emailToken);
                                    emailtokens.set(emailToken, { id: result.userId, expires: emailExpires, for: "register" });
                                    return { s: 200, j: true, d: { m: "User registered successfully", v: true } };
                                }).catch(err => {
                                    console.error("Email sending error:", err);
                                    return { s: 500, j: true, d: { e: "Internal server error. Please check the email service" } };
                                });
                            }
                            else {
                                const token = await generateToken();
                                const expires = new Date().getTime() + 3600000;
                                tokens.set(token, { id: result.userId, expires: expires });
                                return { s: 200, j: true, d: { m: "User registered successfully", v: false, t: { token: token, expires: expires } } };
                            }
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
                else return { s: 400, j: true, d: { e: "Invalid Request" } };
            }
            else if (method === "PATCH") { // Verify email
                if (body && body.exists && body.json && !body.err && body.data.t) {
                    const token = body.data.t;
                    return { s: 500, j: true, d: { e: "Not implemented" } };
                }
                else return { s: 400, j: true, d: { e: "Invalid Request" } };
            }
            else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
        else if (endpoint[0] === "password") {
            if (method === "POST") { // Change password token request
                if (body && body.exists && body.json && !body.err && body.data.u) {
                    const email = body.data.u;
                    return { s: 500, j: true, d: { e: "Not implemented" } };
                }
                else return { s: 400, j: true, d: { e: "Invalid Request" } };
            }
            else if (method === "PATCH") { // Change password
                if (body && body.exists && body.json && !body.err && body.data.t && body.data.p) {
                    const token = body.data.t;
                    const password = body.data.p;
                    return { s: 500, j: true, d: { e: "Not implemented" } };
                }
                else return { s: 400, j: true, d: { e: "Invalid Request" } };
            }
            else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
    }
    else if (endpoint[0] === "verify") {
        if (method === "GET") {
            if (query && query.token && query.purpose) {
                const token = query.token;
                const purpose = query.purpose;
                if (emailtokens.has(token)) {
                    if (emailtokens.get(token).expires < new Date().getTime()) {
                        emailids.delete(emailtokens.get(token).id + "-" + emailtokens.get(token).for);
                        emailtokens.delete(token);
                        return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
                    }
                    else if (emailtokens.get(token).for === purpose) {
                        if (purpose === "register") {
                            return await sql.verifyUser(emailtokens.get(token).id).then(res => {
                                if (res.success) {
                                    emailids.delete(emailtokens.get(token).id + "-" + emailtokens.get(token).for);
                                    emailtokens.delete(token);
                                    return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Email verified successfully. You may log in now." } };
                                }
                                else {
                                    console.error("Database error:", err);
                                    return { s: 500, j: true, d: { e: "Internal server error" } };
                                }
                            }).catch(err => {
                                console.error("Database error:", err);
                                return { s: 500, j: true, d: { e: "Internal server error" } };
                            });
                        }
                    }
                    else return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
                }
                else return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
            }
            else return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    return { s: 400, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI, initDB: sql.initDB };
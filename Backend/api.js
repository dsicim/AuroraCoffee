const sql = require("../Database/server.js");
const fs = require("fs");
const crypto = require('crypto');
const version = require('./version.js');
const tokens = new Map();
const emailtokens = new Map();
const emailids = new Map();
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
const emailRegex = /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/; // RFC 5322 Official Standard email regex
const emailsrv = require("./email.js");
async function generateToken(email = false) {
    let token = crypto.randomBytes(email ? 256 : 128).toString('base64').substring(0, email ? 128 : 64);
    token = token.replaceAll('+', '!').replaceAll('/', '_').replaceAll('=', '-');
    while (email ? emailtokens.has(token) : tokens.has(token)) {
        token = crypto.randomBytes(email ? 256 : 128).toString('base64').substring(0, email ? 128 : 64);
        token = token.replaceAll('+', '!').replaceAll('/', '_').replaceAll('=', '-');
    }
    return token;
}
function validatePassword(p, ids) {
    if (p.length < 8) return { s: false, e: "Password must be at least 8 characters long" };
    if (p.length > 255) return { s: false, e: "Password must not exceed 255 characters" };
    if (!/\p{Ll}/u.test(p)) return { s: false, e: "Password must contain at least one lowercase letter" };
    if (!/\p{Lu}/u.test(p)) return { s: false, e: "Password must contain at least one uppercase letter" };
    if (!/(?:\p{Nd}|[^\p{L}\p{N}\s])/u.test(p)) return { s: false, e: "Password must contain at least one number or symbol" };
    const np = p.toLowerCase().replaceAll(" ", "");
    for (const id of ids) {
        const ni = id.toLowerCase().replaceAll(" ", "");
        if (ni.length > 5) {
            for (let i = 0; i <= ni.length - 5; i++) {
                const sub = ni.substring(i, i + 5);
                if (np.includes(sub)) {
                    return { s: false, e: "Password must not contain parts of your email or name" };
                }
            }
        }
        else {
            if (np.includes(ni)) {
                return { s: false, e: "Password must not contain parts of your email or name" };
            }
        }
    }
    return { s: true };
}
async function invalidateAllTokens(userId) {
    for (const [token, data] of tokens) {
        if (data.id === userId) {
            await tokens.delete(token);
        }
    }
    return;
}
async function handleAPI(method, endpoint, query, body, headers) {
    console.log("API " + method + " ");
    console.log(endpoint);
    console.log(query);
    console.log(body);
    if (endpoint[0] === "version") {
        endpoint.shift();
        if (endpoint[0] === "uptodate") {
            const uptodate = await version.getUpToDateVersion().then(res => res.s ? res.v : null).catch(err => null);
            return { s: 200, j: false, d: uptodate || "Error: Failed to fetch latest version", h: { "Access-Control-Allow-Origin": "*" } };
        }
        return { s: 200, j: false, d: config.version, h: { "Access-Control-Allow-Origin": "*" } };
    }
    else if (endpoint[0] === "auth") {
        endpoint.shift();
        if (endpoint[0] === "login") {
            if (method === "POST") { // Login
                if (body && body.exists && body.json && !body.err && body.data.u && body.data.p && emailRegex.test(body.data.u)) {
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
                                    return await emailsrv.sendEmail(email, "Complete your registration", fs.readFileSync("./verifyemail.html", "utf-8").replaceAll("{token}", "https://" + config.domain + "/api/verify?purpose=register&token=" + emailToken)).then(res => {
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
                if (body && body.exists && body.json && !body.err && body.data.u && body.data.p && body.data.n && emailRegex.test(body.data.u)) {
                    if (body.data.n.length > 255) return { s: 400, j: true, d: { e: "Name must not exceed 255 characters" } };
                    if (body.data.p.length > 255) return { s: 400, j: true, d: { e: "Password must not exceed 255 characters" } };
                    if (body.data.u.length > 255) return { s: 400, j: true, d: { e: "Email address must not exceed 255 characters" } };
                    const pv = validatePassword(body.data.p, [body.data.u.split("@")[0], body.data.n]);
                    if (!pv.s) return { s: 400, j: true, d: { e: pv.e } };
                    const email = body.data.u;
                    const password = body.data.p;
                    const displayname = body.data.n;
                    return await sql.registerUser(email, password, displayname).then(async result => {
                        if (result.success) {
                            result.userId;
                            if (config.verifyemail) {
                                const emailToken = await generateToken(true);
                                const emailExpires = new Date().getTime() + 14400000;
                                return await emailsrv.sendEmail(email, "Complete your registration", fs.readFileSync("./verifyemail.html", "utf-8").replaceAll("{token}", "https://" + config.domain + "/api/verify?purpose=register&token=" + emailToken)).then(res => {
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
            else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
        else if (endpoint[0] === "password") {
            if (method === "POST") { // Change password token request
                if (body && body.exists && body.json && !body.err && body.data.u) {
                    const email = body.data.u;
                    return await sql.findUser(email, false).then(async result => {
                        if (result.success) {
                            let emailvalid = false;
                            if (emailids.has(result.user.id + "-password")) {
                                if (emailtokens.has(emailids.get(result.user.id + "-password"))) {
                                    if (emailtokens.get(emailids.get(result.user.id + "-password")).expires > new Date().getTime()) {
                                        emailvalid = true;
                                    }
                                    else {
                                        emailtokens.delete(emailids.get(result.user.id + "-password"));
                                        emailids.delete(result.user.id + "-password");
                                    }
                                }
                                else emailids.delete(result.user.id + "-password");
                            }
                            if (!emailvalid) {
                                const emailToken = await generateToken(true);
                                const emailExpires = new Date().getTime() + 14400000;
                                return await emailsrv.sendEmail(email, "Password Reset", fs.readFileSync("./passwordemail.html", "utf-8").replaceAll("{token}", "https://" + config.domain + "/api/verify?purpose=password&token=" + emailToken)).then(res => {
                                    console.log("Email sent:", res);
                                    emailids.set(result.userId + "-password", emailToken);
                                    emailtokens.set(emailToken, { id: result.userId, expires: emailExpires, for: "password", user: result.user });
                                    return { s: 200, j: true, d: { m: "We've sent a password reset email to your address. Please check your inbox." } };
                                }).catch(err => {
                                    console.error("Email sending error:", err);
                                    return { s: 500, j: true, d: { e: "Internal server error. Please check the email service" } };
                                });
                            }
                            else return { s: 429, j: true, d: { e: "We've already sent a password reset email to your address. Please check your inbox." } };
                        }
                        else {
                            return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                        }
                    }).catch(err => {
                        console.error("Forgot password request error:", err);
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else return { s: 400, j: true, d: { e: "Invalid Request" } };
            }
            else if (method === "PATCH") { // Change password
                if (body && body.exists && body.json && !body.err && body.data.t && body.data.p) {
                    const token = body.data.t;
                    const password = body.data.p;
                    if (emailtokens.has(token)) {
                        if (emailtokens.get(token).expires < new Date().getTime()) {
                            emailids.delete(emailtokens.get(token).id + "-" + emailtokens.get(token).for);
                            emailtokens.delete(token);
                            return { s: 400, j: true, d: { e: "Invalid or expired token" } };
                        }
                        else if (emailtokens.get(token).for === "password") {
                            const pv = validatePassword(password, [emailtokens.get(token).user.username.split("@")[0], emailtokens.get(token).user.displayname]);
                            if (!pv.s) return { s: 400, j: true, d: { e: pv.e } };
                            return await sql.changePassword(emailtokens.get(token).user.username, password).then(async res => {
                                if (res.success) {
                                    await invalidateAllTokens(emailtokens.get(token).id);
                                    emailids.delete(emailtokens.get(token).id + "-" + emailtokens.get(token).for);
                                    const ltoken = await generateToken();
                                    const expires = new Date().getTime() + 3600000;
                                    tokens.set(ltoken, { id: emailtokens.get(token).id, expires: expires });
                                    emailtokens.delete(token);
                                    return { s: 200, j: true, d: { m: "Password changed successfully", t: { token: ltoken, expires: expires } } };
                                }
                                else {
                                    console.error("Change password error:", err);
                                    return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                                }
                            }).catch(err => {
                                console.error("Change password error:", err);
                                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                            });
                        }
                        else return { s: 400, j: true, d: { e: "Invalid token purpose" } };
                    }
                }
                else if (body && body.exists && body.json && !body.err && body.data.t && body.data.p && body.data.n) {
                    const token = headers.authorization;
                    const password = body.data.p;
                    const newpassword = body.data.n;
                    if (tokens.has(token)) {
                        if (tokens.get(token).expires < new Date().getTime()) {
                            tokens.delete(token);
                            return { s: 401, j: true, d: { e: "Unauthorized" } };
                        }
                        else {
                            const userId = tokens.get(token).id;
                            const email = await sql.findUserById(userId).then(res => {
                                return res.success ? res.user : null;
                            }).catch(err => {
                                return null;
                            });
                            if (!email) return { s: 401, j: true, d: { e: "Unauthorized. User not found." } };
                            const login = await sql.loginUser(email.username, password).then(res => {
                                return res.userId === userId && res.success;
                            }).catch(err => {
                                return false;
                            });
                            if (!login) return { s: 401, j: true, d: { e: "The original password is invalid" } };
                            const pv = validatePassword(newpassword, [email.username.split("@")[0], email.displayname]);
                            if (!pv.s) return { s: 400, j: true, d: { e: pv.e } };
                            return await sql.changePassword(email.username, newpassword).then(async res => {
                                if (res.success) {
                                    await invalidateAllTokens(userId);
                                    const ltoken = await generateToken();
                                    const expires = new Date().getTime() + 3600000;
                                    tokens.set(ltoken, { id: userId, expires: expires });
                                    return { s: 200, j: true, d: { m: "Password changed successfully", t: { token: ltoken, expires: expires } } };
                                }
                                else {
                                    console.error("Change password error:", err);
                                    return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                                }
                            }).catch(err => {
                                console.error("Change password error:", err);
                                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                            });
                        }
                    }
                }
                else return { s: 400, j: true, d: { e: "Invalid Request" } };
            }
            else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
    }
    else if (endpoint[0] === "users") {
        endpoint.shift();
        const token = headers.authorization;
        if (!token) return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (tokens.has(token)) {
            if (tokens.get(token).expires < new Date().getTime()) {
                tokens.delete(token);
                return { s: 401, j: true, d: { e: "Unauthorized" } };
            }
        }
        else return { s: 401, j: true, d: { e: "Unauthorized" } };
        if (endpoint[0] === "me") {
            if (method === "GET") {
                const userId = tokens.get(token).id;
                return await sql.findUser(userId, true).then(res => {
                    if (res.success) {
                        return { s: 200, j: true, d: { user: res.user } };
                    }
                    else {
                        console.error("Find user error:", err);
                        return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    }
                }).catch(err => {
                    console.error("Find user error:", err);
                    if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                    else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                });
            }
            else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
        }
        else return { s: 400, j: true, d: { e: "Not Found" } };
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
                        else if (purpose === "password") {
                            return { s: 302, j: false, d: "", h: { "Location": "/resetpassword?token=" + token } };
                        }
                        else return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
                    }
                    else return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
                }
                else return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
            }
            else return { s: 302, j: false, d: "", h: { "Location": "/login?callback=Invalid verification token" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "restart") {
        if (query && Object.keys(query).length && query.key && query.key === config.restarttoken) {
            if (method === "GET") {
                return { s: 200, j: false, d: fs.readFileSync("./restart.html", "utf-8") };
            }
            else if (method === "POST") {
                if (body && body.exists && body.json && !body.err && body.data.action) {
                    if (body.data.action === "restart") {
                        setTimeout(() => {
                            process.exit(0);
                        }, 2000);
                        return { s: 200, j: false, d: "Server restart initiated. Server will be unresponsive for a few seconds." };
                    }
                    else if (body.data.action === "update") {
                        setTimeout(() => {
                            process.exit(0);
                        }, 2000);
                        return { s: 200, j: false, d: "Server update initiated. Server will be unresponsive for a few minutes." };
                    }
                    else if (body.data.action === "sql") {
                        return { s: 500, j: false, d: "Not implemented yet" };
                    }
                    else if (body.data.action === "sqlrerun") {
                        return { s: 500, j: false, d: "Not implemented yet" };
                    }
                    else if (body.data.action === "reset") {
                        return { s: 500, j: false, d: "Not implemented yet" };
                    }
                }
                else return { s: 400, j: false, d: "Invalid request body" };
            }
        }
        else return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    return { s: 400, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI, initDB: sql.initDB };
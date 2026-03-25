const sql = require("../Database/server.js");
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
                    return {s:500, j:true, d:{e:"Not implemented"}};
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
                    return {s:500, j:true, d:{e:"Not implemented"}};
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
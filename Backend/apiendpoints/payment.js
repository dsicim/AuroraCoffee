const sql = require("../../Database/server.js");
const crypto = require("crypto");
const fetch = require("node-fetch");
async function IyzipayAPI(config, method, url, headers, body) {
    console.log("IyzipayAPI called with:", { method, url, headers, body: JSON.stringify(body) });
    const randomKey = crypto.randomBytes(16).toString("hex");
    const signature = crypto.createHmac("sha256", config.iyzipay.secret).update(randomKey + "/" +url + (body ? JSON.stringify(body) : ""), "utf8").digest("hex");
    return await fetch(config.iyzipay.api + "/" + url, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "IYZWSv2 " + Buffer.from("apiKey:"+config.iyzipay.key+"&randomKey:"+randomKey+"&signature:"+signature).toString("base64"),
            ...headers
        },
        body: body ? JSON.stringify(body) : null
    }).then(res => res.json()).catch(err => err);
}
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint[0] === "carddetails") {
        if (method === "POST") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.bin || !body.data.price || isNaN(parseFloat(body.data.price))) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const binresponse = await IyzipayAPI(config, "POST", "payment/bin/check", {}, {locale:"tr",binNumber: body.bin});
            const insresponse = await IyzipayAPI(config, "POST", "payment/iyzipos/installment", {}, {locale:"tr",price:body.price,binNumber: body.bin});
            if (binresponse && insresponse) {
                if (binresponse.status === "success" && insresponse.status === "success") {
                    return { s: 200, j: true, d: { bin: binresponse, ins: insresponse } };
                }
                else {
                    return { s: 400, j: true, d: { e: "Failed to fetch card details from payment provider", bin: binresponse, ins: insresponse } };
                }
            }
            else {
                return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider", bin: binresponse, ins: insresponse } };
            }
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "methods") {
        if (method === "GET") {
            
        }
        else if (method === "POST") {

        }
        else if (method === "DELETE") {

        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "") {
        return { s: 404, j: true, d: { e: "Not Found" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
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
function getCardDetailsFromResponse(insresponse) {
    return { type: {"CREDIT_CARD":"Credit Card","DEBIT_CARD":"Debit Card","PREPAID_CARD":"Prepaid Card"}[insresponse.cardType] || "Unknown Card", provider: {"VISA":"Visa","MASTER_CARD":"MasterCard","AMERICAN_EXPRESS":"American Express","TROY":"Troy"}[insresponse.cardAssociation] || "Unknown", family: insresponse.cardFamily || insresponse.cardFamilyName || "Unknown", bank: insresponse.bankName || "Unknown", business: insresponse.commercial === 1 ? true : false };
}
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint[0] === "installments") {
        if (method === "POST") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.bin) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const insresponse = (!body.data.price || isNaN(parseFloat(body.data.price))) ? await IyzipayAPI(config, "POST", "payment/bin/check", {}, {locale:"en",binNumber: body.data.bin}) : await IyzipayAPI(config, "POST", "payment/iyzipos/installment", {}, {locale:"en",price:body.data.price,binNumber: body.data.bin});
            if (insresponse) {
                if (insresponse.status === "success") {
                    if (!body.data.price || isNaN(parseFloat(body.data.price))) return { s: 200, j: true, d: { card: {...getCardDetailsFromResponse(insresponse)} } };
                    else if (insresponse.installmentDetails && insresponse.installmentDetails[0]) return { s: 200, j: true, d: { card: {...getCardDetailsFromResponse(insresponse.installmentDetails[0]), agriculture: insresponse.agricultureEnabled === 1 ? true : false}, features: {force3DS: insresponse.installmentDetails[0].force3ds === 1 ? true: false, forceCVC: insresponse.installmentDetails[0].forceCvc === 1 ? true: false, DCCEnabled: insresponse.installmentDetails[0].dccEnabled === 1 ? true: false}, installments: (insresponse.installmentDetails[0].installmentPrices) ? insresponse.installmentDetails[0].installmentPrices.map(x => ({ months: x.installmentNumber, total: x.totalPrice, permonth: x.installmentPrice })): [] } };
                    else return { s: 404, j: true, d: { e: "Installment details not found" } };
                }
                else {
                    return { s: 400, j: true, d: { e: "Failed to fetch details from payment provider" } };
                }
            }
            else {
                return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider" } };
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
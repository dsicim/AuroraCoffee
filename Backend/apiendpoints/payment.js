const sql = require("../../Database/server.js");
const crypto = require("crypto");
const fetch = require("node-fetch");
const aes = require("./aes256.js");
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
    return { type: {"CREDIT_CARD":"Credit Card","DEBIT_CARD":"Debit Card","PREPAID_CARD":"Prepaid Card"}[insresponse.cardType] || "Unknown Card", provider: {"VISA":"Visa","MASTER_CARD":"MasterCard","AMERICAN_EXPRESS":"American Express","TROY":"Troy"}[insresponse.cardAssociation] || "Unknown", family: insresponse.cardFamily || insresponse.cardFamilyName || "Unknown", bank: insresponse.bankName || insresponse.cardBankName || "Unknown", business: insresponse.commercial === 1 ? true : false };
}
function validateCreditCard(card, ignorecvc = false) {
    if (!card || !card.number || !card.expiry || (!card.cvc && !ignorecvc) || !card.holder) return { valid: false, error: "Missing required card fields" };
    if (!card.expiry.month || !card.expiry.year) return { valid: false, error: "Invalid expiry format" };
    const expiryMonth = parseInt(card.expiry.month);
    const expiryYear = parseInt(card.expiry.year);
    const current = new Date();
    if (isNaN(expiryMonth) || isNaN(expiryYear) || expiryMonth < 1 || expiryMonth > 12) return { valid: false, error: "Invalid expiry date" };
    if (expiryYear < current.getFullYear() || (expiryYear === current.getFullYear() && expiryMonth < current.getMonth() + 1)) return { valid: false, error: "Card has expired" };
    if (!/^\d{3,4}$/.test(card.cvc) && !ignorecvc) return { valid: false, error: "Invalid CVC" };
    if (!/^\d{13,19}$/.test(card.number.replace(/\s+/g, ''))) return { valid: false, error: "Invalid card number format" };
    if (card.holder.trim().length === 0) return { valid: false, error: "Cardholder name cannot be empty" };
    let sum = 0;
    let double = false;
    for (let i = card.number.length - 1; i >= 0; i--) {
        let digit = parseInt(card.number[i]);
        if (double) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        double = !double;
    }
    if (sum % 10 !== 0) return { valid: false, error: "Invalid card number" };
    return { valid: true, card: {cardNumber: card.number, cardHolderName: card.holder, expireMonth: card.expiry.month, expireYear: card.expiry.year, cvc: card.cvc || undefined} };
}
async function createCardToken(userId, cardToken) {
    const payload = aes.encrypt(cardToken, userId);
    return await sql.setUserCards(userId, JSON.stringify(payload)).then(res => {
        if (res.success) {
            return { done: true };
        }
        else if (res.error) {
            return { done: false, error: res.error };
        }
    }).catch(err => {
        return { done: false, error: err.message };
    });
}
async function getCardToken(userId) {
    return await sql.getUserCards(userId).then(res => {
        if (res.success) {
            if (!res.cardTokens) return { done: true, value: null };
            res.cardTokens = JSON.parse(res.cardTokens);
            const token = aes.decrypt(res.cardTokens, userId);
            return { done: true, value: token };
        }
        else if (res.error) {
            return { done: false, error: res.error };
        }
    }).catch(err => {
        return { done: false, error: err.message };
    });
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
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            const currentToken = await getCardToken(currentUser.id);
            if (!currentToken.done) return { s: 500, j: true, d: { e: "Failed to retrieve stored card information: " + currentToken.error } };
            if (!currentToken.value) return { s: 200, j: true, d: { cards: [] } };
            const response = await IyzipayAPI(config, "POST", "cardstorage/cards", {}, {locale:"en",cardUserKey: currentToken.value});
            if (response) {
                if (response.status === "success" && response.cardDetails) {
                    const currentCards = response.cardDetails.map(cd => ({ id: cd.cardToken, alias: cd.cardAlias, last4dig: cd.lastFourDigits, ...getCardDetailsFromResponse(cd) }))
                    return { s: 200, j: true, d: { cards: currentCards.map(cd => ({id:cd.id,alias:cd.alias,last4dig:cd.last4dig,type:cd.type,provider:cd.provider,family:cd.family,bank:cd.bank})) } };
                }
                else return { s: 400, j: true, d: { e: "Failed to retrieve cards from payment provider: " + response.errorMessage } };
            }
            else return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider" } };
        }
        else if (method === "POST") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.card) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const card = validateCreditCard(body.data.card, true);
            if (!card.valid) return { s: 400, j: true, d: { e: "Invalid card details: " + card.error } };
            const currentToken = await getCardToken(currentUser.id);
            if (!currentToken.done) return { s: 500, j: true, d: { e: "Failed to retrieve stored card information: " + currentToken.error } };
            if (!currentToken.value) {
                const response = await IyzipayAPI(config, "POST", "cardstorage/card", {}, {locale:"en",email:currentUser.username,card:{cardAlias: body.data.alias, ...card.card}});
                if (response) {
                    if (response.status === "success" && response.cardUserKey) {
                        const storeResult = await createCardToken(currentUser.id, response.cardUserKey);
                        if (storeResult.done) {
                            return { s: 200, j: true, d: { msg: "Card stored successfully" } };
                        }
                        else {
                            return { s: 500, j: true, d: { e: "Failed to store card information in the database: " + storeResult.error } };
                        }
                    }
                    else return { s: 400, j: true, d: { e: "Failed to store card with payment provider: " + response.errorMessage } };
                }
                else return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider" } };
            }
            else {
                const response = await IyzipayAPI(config, "POST", "cardstorage/card", {}, {locale:"en",cardUserKey:currentToken,card:{cardAlias: body.data.alias, ...card.card}, cardUserKey: currentToken.value});
                if (response) {
                    if (response.status === "success" && response.cardUserKey) {
                        return { s: 200, j: true, d: { msg: "Card stored successfully" } };
                    }
                    else return { s: 400, j: true, d: { e: "Failed to store card with payment provider: " + response.errorMessage } };
                }
                else return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider" } };
            }
        }
        else if (method === "DELETE") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.cardToken) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const currentToken = await getCardToken(currentUser.id);
            if (!currentToken.done) return { s: 500, j: true, d: { e: "Failed to retrieve stored card information: " + currentToken.error } };
            if (!currentToken.value) return { s: 400, j: true, d: { e: "No stored cards found for user" } };
            const response = await IyzipayAPI(config, "DELETE", "cardstorage/card", {}, {locale:"en",cardUserKey: currentToken.value, cardToken: body.data.cardToken});
            if (response) {
                if (response.status === "success") {
                    return { s: 200, j: true, d: { msg: "Card deleted successfully" } };
                }
                else return { s: 400, j: true, d: { e: "Failed to delete card with payment provider: " + response.errorMessage } };
            }
            else return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "initiate") {
        if (method === "POST") {
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
            if (!body || !body.exists || body.err || !body.json || !body.data || (!body.data.card && !body.data.cardToken)) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const currentToken = body.data.cardToken ? await getCardToken(currentUser.id) : null;
            if (currentToken && !currentToken.done) return { s: 500, j: true, d: { e: "Failed to retrieve stored card information: " + currentToken.error } };
            const card = body.data.cardToken ? {
                "cardUserKey": currentToken.value,
                "cardToken": body.data.cardToken,
                "cvc": body.data.card.cvc,
            } : validateCreditCard(body.data.card);
            const payload = {
                locale: "en",
                price: 100,
                paidPrice: 100,
                currency: "TRY",
                installment: 1,
                paymentCard: card,
                buyer: {
                    id: String(currentUser.id),
                    name: currentUser.displayname.split(' ').slice(0, -1).join(' ') || currentUser.displayname,
                    surname: currentUser.displayname.split(' ').slice(-1)[0] || ".",
                    identityNumber: "11111111111", // Do you really need this?????
                    email: currentUser.username,
                    gsmNumber: "+900000000000", // Do you really need this?????
                    registrationAddress: "N/A", // Take this from billing address!
                    city: "N/A", // Take this from billing address!
                    country: "N/A", // Take this from billing address!
                },
                shippingAddress: {
                    contactName: currentUser.displayname,
                    city: "N/A", // Take this from shipping address!
                    country: "N/A", // Take this from shipping address!
                    address: "N/A", // Take this from shipping address!
                    zipCode: "00000" // Take this from shipping address!
                },
                billingAddress: {
                    contactName: currentUser.displayname,
                    city: "N/A", // Take this from billing address!
                    country: "N/A", // Take this from billing address!
                    address: "N/A", // Take this from billing address!
                    zipCode: "00000" // Take this from billing address!
                },
                basketItems: [ // You should replace this with actual cart items for probably legal reasons.
                    {
                        id: String(currentUser.id) + ":" + "cartID",
                        price: 100,
                        name: "Cart Items for this guy",
                        category1: "Cart",
                        itemType: "PHYSICAL"
                    }
                ]
            }
            const response = await IyzipayAPI(config, "POST", "payment/auth", {}, payload);
            if (response) {
                if (response.status === "success") {
                    return { s: 200, j: true, d: { response: response } };
                }
                else return { s: 400, j: true, d: { e: "Failed to retrieve payment information from payment provider: " + response.errorMessage } };
            }
            else return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
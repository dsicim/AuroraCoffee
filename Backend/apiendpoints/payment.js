const sql = require("../../Database/server.js");
const crypto = require("crypto");
const fetch = require("node-fetch");
const aes = require("../aes256.js");
const fs = require("fs");
const mailer = require("../email.js");
async function IyzipayAPI(config, method, url, headers, body) {
    console.log("IyzipayAPI called with:", { method, url, headers, body: JSON.stringify(body) });
    const randomKey = crypto.randomBytes(16).toString("hex");
    const signature = crypto.createHmac("sha256", config.iyzipay.secret).update(randomKey + "/" + url + (body ? JSON.stringify(body) : ""), "utf8").digest("hex");
    return await fetch(config.iyzipay.api + "/" + url, {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "IYZWSv2 " + Buffer.from("apiKey:" + config.iyzipay.key + "&randomKey:" + randomKey + "&signature:" + signature).toString("base64"),
            ...headers
        },
        body: body ? JSON.stringify(body) : null
    }).then(res => res.json()).catch(err => err);
}
function checkTrim(x) {
    if (x === undefined || x === null) return undefined;
    if (typeof x !== "string") return undefined;
    const trimmed = x.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function getCardDetailsFromResponse(insresponse, setUnknown = "Unknown") {
    return { type: { "CREDIT_CARD": "Credit Card", "DEBIT_CARD": "Debit Card", "PREPAID_CARD": "Prepaid Card" }[insresponse.cardType] || setUnknown, provider: { "VISA": "Visa", "MASTER_CARD": "MasterCard", "AMERICAN_EXPRESS": "American Express", "TROY": "Troy" }[insresponse.cardAssociation] || setUnknown, family: insresponse.cardFamily || insresponse.cardFamilyName || setUnknown, bank: insresponse.bankName || insresponse.cardBankName || setUnknown, business: insresponse.commercial === 1 ? true : false };
}
const tokens = new Map();
async function generateToken() {
    let token = crypto.randomBytes(128).toString('base64').replaceAll('+', '').replaceAll('/', '').replaceAll('=', '').substring(0, 64);
    while (tokens.has(token)) {
        token = crypto.randomBytes(128).toString('base64').replaceAll('+', '').replaceAll('/', '').replaceAll('=', '').substring(0, 64);
    }
    return token;
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
    return { valid: true, card: { cardNumber: card.number, cardHolderName: card.holder, expireMonth: card.expiry.month, expireYear: card.expiry.year, cvc: card.cvc || undefined } };
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
            res.cardTokens = aes.pjs(res.cardTokens);
            if (res.cardTokens.e && res.cardTokens.e.startsWith("Failed to parse JSON: ")) return { done: false, error: "Malformed data found on database" };
            const token = aes.decrypt(res.cardTokens, userId);
            if (token.s) return { done: true, value: token.value };
            else return { done: false, error: token.e };
        }
        else if (res.error) {
            return { done: false, error: res.error };
        }
    }).catch(err => {
        return { done: false, error: err.message };
    });
}
function currencyToSymbol(currency, price) {
    const symbol = { "USD": "$", "EUR": "€", "GBP": "£", "TRY": "₺", "NOK": "kr" }[currency] || currency + " ";
    if (["TRY", "NOK"].includes(currency)) return price.toFixed(2) + " " + currency;
    else return symbol + price.toFixed(2);
}
async function emailInvoice(email, orderNumber, details) {
    console.log('cwd', process.cwd());
    let instemplate = fs.readFileSync("./"+(details.installment.months === 1 ?"orderemailinfull":"orderemailinstallment")+".html", "utf-8");
    if (details.installment.months > 1) {
        instemplate = instemplate.replaceAll("{{ORDER_TOTAL}}", currencyToSymbol(details.currency, details.price.total))
        .replaceAll("{{INSTALLMENT_INTEREST}}", currencyToSymbol(details.currency, details.price.installment))
        .replaceAll("{{ORDER_MONTH}}", currencyToSymbol(details.currency, details.installment.permonth))
        .replaceAll("{{INSTALLMENT_PERIOD}}", details.installment.months)
        .replaceAll("{{ORDER_TOTAL_WITH_INTEREST}}", currencyToSymbol(details.currency, details.price.paid));
    }
    else {
        instemplate = instemplate.replaceAll("{{ORDER_TOTAL}}", currencyToSymbol(details.currency, details.price.paid));
    }
    const itemstemplate = fs.readFileSync("./orderemailitems.html", "utf-8");
    let itemshtml = "";
    details.products.forEach(product => {
        let optionstext = "";
        Object.keys(product.options || {}).forEach(key => {
            optionstext += key + ": " + product.options[key] + ", ";
        });
        optionstext = optionstext.length > 2 ? optionstext.slice(0, -2) : "";
        itemshtml += itemstemplate.replaceAll("{{ITEM_NAME}}", product.product_name)
        .replaceAll("{{ITEM_OPTIONS}}", optionstext)
        .replaceAll("{{ITEM_AMOUNT}}", product.quantity)
        .replaceAll("{{ITEM_PRICE}}", currencyToSymbol(details.currency, product.product_price));
    });
    const template = fs.readFileSync("./orderemail.html", "utf-8")
    .replaceAll("{{ORDER_ID}}", orderNumber)
    .replaceAll("{{ORDER_URL}}","https://" + config.domain + "/account/orders/"+orderNumber)
    .replaceAll("{{CUSTOMER_NAME}}", details.shippingAddress.name + " " + details.shippingAddress.surname)
    .replaceAll("{{ADDRESS_LINE}}", details.shippingAddress.address + (details.shippingAddress.address2 ? ", " + details.shippingAddress.address2 : "") + ", " + details.shippingAddress.city)
    .replaceAll("{{CITY}}", details.shippingAddress.province)
    .replaceAll("{{POSTAL_CODE}}", details.shippingAddress.zip)
    .replaceAll("{{PHONE}}", details.shippingAddress.phone)
    .replaceAll("{{SUBTOTAL}}", currencyToSymbol(details.currency, details.price.subtotal))
    .replaceAll("{{VAT_TOTAL}}", currencyToSymbol(details.currency, details.price.tax))
    .replaceAll("{{SHIPPING_TOTAL}}", currencyToSymbol(details.currency, details.price.shipping))
    .replaceAll("{{ORDER_INSTALLMENT_HTML}}", instemplate)
    .replaceAll("{{ORDER_ITEMS}}", itemshtml);
    await mailer.sendEmail(email, "Your order invoice of your recent purchase", template).then(res => {
        console.log("Email sent:", res);
    }).catch(err => {
        console.error("Email sending error:", err);
    });
}
async function createOrder(config, currentUser, cart, basket, subtotal, shippingAddress, billingAddress, card, cardDetails, installment = 1, currency = "TRY") {
    let realPrice = subtotal;
    if (installment && installment > 1) {
        const actualInstallment = cardDetails.installments.find(ins => ins.months === parseInt(installment));
        realPrice = actualInstallment ? actualInstallment.total : subtotal;
    }
    billingAddress.open = billingAddress.address + ", " + (billingAddress.address2 ? billingAddress.address2 + ", " : "") + billingAddress.city;
    shippingAddress.open = shippingAddress.address + ", " + (shippingAddress.address2 ? shippingAddress.address2 + ", " : "") + shippingAddress.city;
    const ins = cardDetails.installments.find(ins => ins.months === parseInt(installment));
    let taxes = 0;
    let stotal = 0;
    cart.forEach(item => {
        item.product_price = parseFloat(item.product_price);
        taxes += item.taxAmount;
        stotal += item.subtotal;
    });
    const details = {
        products: cart,
        shippingAddress,
        billingAddress,
        card: {
            type: cardDetails.type,
            provider: cardDetails.provider,
            family: cardDetails.family,
            bank: cardDetails.bank,
            last4dig: cardDetails.last4dig || card.number.substring(card.number.length - 4)
        },
        installment: ins,
        price: {
            subtotal: stotal,
            tax: taxes,
            shipping: 0,
            total: subtotal,
            installment: realPrice - subtotal,
            paid: realPrice,
        },
        currency: currency
    };
    const payload = {
        locale: "en",
        price: subtotal,
        paidPrice: realPrice,
        currency: currency,
        installment: installment,
        paymentCard: card,
        callbackUrl: "https://" + config.domain + "/api/payment/3dscallback",
        basketId: cart[0].id.toString(),
        buyer: {
            id: currentUser.id.toString(),
            name: currentUser.displayname.split(' ').slice(0, -1).join(' ') || currentUser.displayname,
            surname: currentUser.displayname.split(' ').slice(-1)[0],
            identityNumber: "11111111111", // We are not collecting this information, but it's required by the payment provider, so we will just send a dummy value
            email: currentUser.username,
            gsmNumber: billingAddress.phone,
            registrationAddress: billingAddress.open,
            city: billingAddress.province,
            country: billingAddress.country,
        },
        shippingAddress: {
            contactName: shippingAddress.name + " " + shippingAddress.surname,
            city: shippingAddress.province,
            country: shippingAddress.country,
            address: shippingAddress.open,
            zipCode: shippingAddress.zip
        },
        billingAddress: {
            contactName: billingAddress.name + " " + billingAddress.surname,
            city: billingAddress.province,
            country: billingAddress.country,
            address: billingAddress.open,
            zipCode: billingAddress.zip
        },
        basketItems: basket
    }
    return {s: true, p: payload, o: {user: currentUser.id, details: JSON.stringify(aes.encrypt(JSON.stringify(details), currentUser.id)), detailsOpen: details}};
}
async function completeCart(products) {
    for (const product of products) {
        await sql.decreaseStock(product.id, product.quantity).then(res => {}).catch(err => {});
    }
    return true;
}
function PaymentError(err, errorMsg, tvoyBank = "your bank") {
    console.error("Payment error:", err, errorMsg);
    return {
        "DO_NOT_HONOUR": { why: "The transaction was declined by the card issuer.", resolution: "Please use a different card or contact " + tvoyBank + "." },
        "INVALID_TRANSACTION": { why: "The transaction is invalid.", resolution: "Please use a different card or contact " + tvoyBank + "." },
        "FRAUD_SUSPECT": { why: "The transaction was blocked by " + tvoyBank + ".", resolution: "Contact " + tvoyBank + " for further information." },
        "PICKUP_CARD": { why: "The transaction was blocked by " + tvoyBank + ".", resolution: "Contact " + tvoyBank + " for further information." },
        "LOST_CARD": { why: "The transaction was blocked by " + tvoyBank + ".", resolution: "Contact " + tvoyBank + " for further information." },
        "STOLEN_CARD": { why: "The transaction was blocked by " + tvoyBank + ".", resolution: "Contact " + tvoyBank + " for further information." },
        "NOT_SUFFICIENT_FUNDS": { why: "The card has insufficient funds.", resolution: "Please add more money to the card's account or use a different card." },
        "EXPIRED_CARD": { why: "The card has expired.", resolution: "Please use a different card or contact " + tvoyBank + "." },
        "NOT_PERMITTED_TO_CARDHOLDER": { why: tvoyBank.substring(0, 1).toUpperCase() + tvoyBank.substring(1) + " has restricted this card's ability to make purchases.", resolution: "Contact " + tvoyBank + " for further information." },
        "NOT_PERMITTED_TO_TERMINAL": { why: tvoyBank.substring(0, 1).toUpperCase() + tvoyBank.substring(1) + " has restricted our ability to process this transaction.", resolution: "Use a different card of contact the developers." },
        "INVALID_CVC2": { why: "The CVC code is invalid.", resolution: "Please check the CVC code and try again." },
        "INVALID_CAVV": { why: "The CVC code is invalid.", resolution: "Please check the CVC code and try again." },
        "RESTRICTED_BY_LAW": { why: "This card is not able to make online purchases.", resolution: "Contact " + tvoyBank + " or use it's mobile app to enable online purchases on this card and try again." },
        "CARD_NOT_PERMITTED": { why: "The transaction was blocked by " + tvoyBank + ".", resolution: "Contact " + tvoyBank + " for further information." },
        "UNKNOWN": { why: "An unknown error occurred.", resolution: "Contact the developers for further information." },
        "INVALID_XML_END_TAG": { why: "An unknown error occurred.", resolution: "Contact the developers for further information." },
        "INVALID_CHARS_IN_EMAIL": { why: "The email address contains invalid characters.", resolution: "Please check the email address and try again." },
        "REFER_TO_CARD_ISSUER": { why: tvoyBank.substring(0, 1).toUpperCase() + tvoyBank.substring(1) + " needs confirmation from the cardholder.", resolution: "Contact " + tvoyBank + " for them to approve the transaction." },
        "INVALID_MERCHANT_OR_SP": { why: "The merchant or service provider is invalid.", resolution: "Contact the developers for further information." },
        "BLOCKED_CARD": { why: "This card is blocked for purchases.", resolution: "Contact " + tvoyBank + " for further information." },
        "INVALID_ECI": { why: "There's an issue with your card's security information.", resolution: "Contact " + tvoyBank + " for further information." },
        "CVC2_MAX_ATTEMPT": { why: "The CVC code has been entered incorrectly too many times.", resolution: "Contact " + tvoyBank + " for further verification." },
        "BIN_NOT_FOUND": { why: "Your bank doesn't exist.", resolution: "Contact the developers for further information." },
    }[err] || { why: errorMsg || "Unknown error", resolution: "Please try again later or contact the developers" };
}
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint[0] === "installments") {
        if (method === "POST") {
            if (!body || !body.exists || body.err || !body.json || !body.data || (!body.data.bin && !body.data.token)) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if (body.data.token) {
                if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
                const currentToken = await getCardToken(currentUser.id);
                if (!currentToken.done) return { s: 500, j: true, d: { e: "Failed to retrieve stored card information: " + currentToken.error } };
                if (!currentToken.value) return { s: 200, j: true, d: { e: "Card not found" } };
                const response = await IyzipayAPI(config, "POST", "cardstorage/cards", {}, { locale: "en", cardUserKey: currentToken.value });
                if (response) {
                    if (response.status === "success" && response.cardDetails) {
                        response.cardDetails.forEach(cd => {
                            if (cd.cardToken === body.data.token) {
                                body.data.bin = cd.binNumber;
                            }
                        });
                        if (!body.data.bin || body.data.bin.length < 6) return { s: 404, j: true, d: { e: "Card not found" } };
                    }
                    else return { s: 400, j: true, d: { e: "Failed to retrieve cards from payment provider: " + response.errorMessage } };
                }
                else return { s: 500, j: true, d: { e: "An unknown error occurred while communicating with the payment provider" } };
            }
            const insresponse = (!body.data.price || isNaN(parseFloat(body.data.price))) ? await IyzipayAPI(config, "POST", "payment/bin/check", {}, { locale: "en", binNumber: body.data.bin }) : await IyzipayAPI(config, "POST", "payment/iyzipos/installment", {}, { locale: "en", price: body.data.price, binNumber: body.data.bin });
            if (insresponse) {
                if (insresponse.status === "success") {
                    if (!body.data.price || isNaN(parseFloat(body.data.price))) return { s: 200, j: true, d: { card: { ...getCardDetailsFromResponse(insresponse) } } };
                    else if (insresponse.installmentDetails && insresponse.installmentDetails[0]) return { s: 200, j: true, d: { card: { ...getCardDetailsFromResponse(insresponse.installmentDetails[0]), agriculture: insresponse.agricultureEnabled === 1 ? true : false }, features: { force3DS: insresponse.installmentDetails[0].force3ds === 1 ? true : false, forceCVC: insresponse.installmentDetails[0].forceCvc === 1 ? true : false, DCCEnabled: insresponse.installmentDetails[0].dccEnabled === 1 ? true : false }, installments: (insresponse.installmentDetails[0].installmentPrices) ? insresponse.installmentDetails[0].installmentPrices.map(x => ({ months: x.installmentNumber, total: x.totalPrice, permonth: x.installmentPrice })) : [] } };
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
            const response = await IyzipayAPI(config, "POST", "cardstorage/cards", {}, { locale: "en", cardUserKey: currentToken.value });
            if (response) {
                if (response.status === "success" && response.cardDetails) {
                    const currentCards = response.cardDetails.map(cd => ({ id: cd.cardToken, alias: cd.cardAlias, last4dig: cd.lastFourDigits, ...getCardDetailsFromResponse(cd) }))
                    return { s: 200, j: true, d: { cards: currentCards.map(cd => ({ id: cd.id, alias: cd.alias, last4dig: cd.last4dig, type: cd.type, provider: cd.provider, family: cd.family, bank: cd.bank })) } };
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
                const response = await IyzipayAPI(config, "POST", "cardstorage/card", {}, { locale: "en", email: currentUser.username, card: { cardAlias: body.data.alias, ...card.card } });
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
                const response = await IyzipayAPI(config, "POST", "cardstorage/card", {}, { locale: "en", cardUserKey: currentToken, card: { cardAlias: body.data.alias, ...card.card }, cardUserKey: currentToken.value });
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
            const response = await IyzipayAPI(config, "DELETE", "cardstorage/card", {}, { locale: "en", cardUserKey: currentToken.value, cardToken: body.data.cardToken });
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
            if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { success: false, e: { what: "Account", why: "Unauthorized", resolution: "Please log in again" } } };
            if (!body || !body.exists || body.err || !body.json || !body.data) return { s: 412, j: true, d: { success: false, e: { what: "Information", why: "Invalid request body", resolution: "Please provide the necessary information" } } };
            // Required fields validation
            if (!body.data.cart || !Array.isArray(body.data.cart) || body.data.cart.length === 0) return { s: 412, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Cart details are missing or invalid", resolution: "Please provide valid cart details from your session" } } };
            if (!body.data.billing || typeof body.data.billing !== "object") return { s: 412, j: true, d: { success: false, e: { what: "Billing Address", why: "Billing address details are missing or invalid", resolution: "Please provide valid billing address details" } } };
            if (!body.data.shipping || typeof body.data.shipping !== "object") return { s: 412, j: true, d: { success: false, e: { what: "Shipping Address", why: "Shipping address details are missing or invalid", resolution: "Please provide valid shipping address details" } } };
            if (body.data.installments && (isNaN(parseInt(body.data.installments)) || parseInt(body.data.installments) < 1)) return { s: 412, j: true, d: { success: false, e: { what: "Installments", why: "Installment count is invalid", resolution: "Please provide a valid installment count or pay in full if not applicable" } } };
            if (body.data.currency && typeof body.data.currency !== "string") return { s: 412, j: true, d: { success: false, e: { what: "Currency", why: "Currency is invalid", resolution: "Please provide a valid currency code or default to TRY if not applicable" } } };
            if (!body.data.currency) body.data.currency = "TRY";
            if (!["TRY", "USD", "EUR", "GBP", "RUB", "CHF", "NOK"].includes(body.data.currency)) return { s: 412, j: true, d: { success: false, e: { what: "Currency", why: "Currency is not supported", resolution: "We only support TRY, USD, EUR, GBP, RUB, CHF, and NOK" } } };
            if (["USD", "EUR", "GBP", "RUB", "CHF", "NOK"].includes(body.data.currency) && !config.iyzipay.supported_foreign_currencies) return { s: 412, j: true, d: { success: false, e: { what: "Currency", why: "Foreign currency payments are not supported yet", resolution: "Please use TRY as the currency for now" } } };
            const billingToken = body.data.billing.token || null;
            const shippingToken = body.data.shipping.token || null;
            if (!billingToken && (!body.data.billing.name || !body.data.billing.surname || !body.data.billing.address || !body.data.billing.city || !body.data.billing.province || !body.data.billing.country || !body.data.billing.zip || !body.data.billing.phone)) return { s: 412, j: true, d: { success: false, e: { what: "Billing Address", why: "Billing address details are missing", resolution: "Please provide valid billing address details" } } };
            if (!shippingToken && (!body.data.shipping.name || !body.data.shipping.surname || !body.data.shipping.address || !body.data.shipping.city || !body.data.shipping.province || !body.data.shipping.country || !body.data.shipping.zip || !body.data.shipping.phone)) return { s: 412, j: true, d: { success: false, e: { what: "Shipping Address", why: "Shipping address details are missing", resolution: "Please provide valid shipping address details" } } };
            if (!body.avoid3DS && body.avoid3DS !== false) body.avoid3DS = true; // Default to true if not provided


            // Shopping Cart Validation
            if (!body.data.expected || isNaN(parseFloat(body.data.expected))) return { s: 412, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Expected cart total is missing or invalid", resolution: "Please provide the expected total price of the cart based on your session data" } } };
            body.data.cart.forEach(item => {
                if (!item.id || isNaN(parseInt(item.id))) item = undefined;
                else if (!item.qty || isNaN(parseInt(item.qty))) item.qty = 1;
                else if (!item.opt || item.opt == undefined || item.opt == null) item.opt = {};
                else if (typeof item.opt === "string") {
                    try {
                        item.opt = JSON.parse(item.opt);
                    } catch (err) {
                        item.opt = {};
                    }
                }
            })
            body.data.cart = body.data.cart.filter(item => item !== undefined);
            if (body.data.cart.length === 0) return { s: 412, j: true, d: { success: false, e: { what: "Shopping Cart", why: "All cart items are invalid", resolution: "Make sure all items in your cart are valid" } } };
            let actualCart = await sql.getCart(currentUser.id).then(result => {
                if (result.success) return {
                    s: true, cart: result.cart.map(item => {
                        item.options = item.options ? aes.pjs(item.options) : {};
                        if (item.options.e && item.options.e.startsWith("Failed to parse JSON: ")) item.options = {};
                        return item;
                    })
                };
                else return { s: false, e: "An unknown error occurred" };
            }).catch(err => {
                console.error("Get cart error:", err);
                if (err instanceof sql.DBError) return { s: false, e: err.error || "An unknown error occurred" };
                else return { s: false, e: "An unknown error occurred" };
            });
            if (!actualCart.s) return { s: 500, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Failed to retrieve cart information: " + actualCart.e, resolution: "Please try again later or contact the developers" } } };
            actualCart = actualCart.cart;
            let expectedPrice = body.data.expected;
            let totalPrice = 0;
            actualCart.forEach(item => {
                totalPrice += parseFloat(item.product_price) * item.quantity;
            });

            if (totalPrice !== parseFloat(expectedPrice)) return { s: 409, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Cart could be modified by the same user from another device", resolution: "Please confirm your up-to date cart contents with possible price changes before confirming your order." } } };
            let cartTampered = false;
            let internalIssue = false;
            const productsMentioned = [];
            body.data.cart.forEach(providedItem => {
                if (!cartTampered) {
                    let matches = actualCart.filter(actualItem => actualItem.product_id === providedItem.id);
                    if (matches.length === 0) cartTampered = true;
                    else {
                        if (!productsMentioned.includes(providedItem.id)) productsMentioned.push(providedItem.id);
                        matches = matches.filter(match => {
                            if (Object.keys(match.options).length !== Object.keys(providedItem.opt).length) return false;
                            for (let key of Object.keys(match.options)) {
                                if (match.options[key] != providedItem.opt[key]) return false;
                            }
                            return true;
                        });
                        if (matches.length === 0) cartTampered = true;
                        else {
                            matches = matches.filter(match => match.quantity === providedItem.qty);
                            if (matches.length === 0) cartTampered = true;
                            else if (matches.length > 1) {
                                cartTampered = true;
                                internalIssue = true;
                            }
                        }
                    }
                }
            });
            if (!cartTampered && !internalIssue) actualCart.forEach(item => {
                if (!cartTampered) {
                    let matches = body.data.cart.filter(pi => pi.id === item.product_id);
                    if (matches.length === 0) cartTampered = true;
                    else {
                        if (!productsMentioned.includes(item.product_id)) productsMentioned.push(item.product_id);
                        matches = matches.filter(match => {
                            if (Object.keys(match.opt).length !== Object.keys(item.options).length) return false;
                            for (let key of Object.keys(match.opt)) {
                                if (match.opt[key] != item.options[key]) return false;
                            }
                            return true;
                        });
                        if (matches.length === 0) cartTampered = true;
                        else {
                            matches = matches.filter(match => match.qty === item.quantity);
                            if (matches.length === 0) cartTampered = true;
                            else if (matches.length > 1) {
                                cartTampered = true;
                                internalIssue = true;
                            }
                        }
                    }
                }
            });
            if (internalIssue) return { s: 500, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Internal data integrity issue detected in cart information", resolution: "Please remove identical items with identical options and quantities from your cart and then try again." } } };
            if (cartTampered) return { s: 409, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Cart has been modified by the same user from another device", resolution: "Please confirm your up-to date cart contents before confirming your order." } } };
            let productslist = await sql.getProductsByIds(productsMentioned).then(result => {
                if (result.success) return { s: true, products: result.products, idsnotfound: result.idsnotfound };
                else {
                    return { s: false, e: result };
                }
            }).catch(err => {
                console.error("Get products by IDs error:", err);
                if (err instanceof sql.DBError) return { s: false, e: err.error || "Unknown error" };
                else return { s: false, e: "Unknown error" };
            });
            if (!productslist.s) return { s: 500, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Failed to retrieve product information: " + productslist.e, resolution: "Please try again later or contact the developers" } } };
            if (productslist.idsnotfound.length > 0) return { s: 500, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Some products in the cart could not be found in the database: " + productslist.idsnotfound.join(", "), resolution: "Please remove the mentioned products from your cart and then try again." } } };
            if (productslist.products.length === 0) return { s: 500, j: true, d: { success: false, e: { what: "Shopping Cart", why: "No products in the cart could be found in the database", resolution: "Please confirm your cart contents and then try again." } } };
            let products = {};
            productslist.products.forEach(p => {
                products[p.id] = p;
            });
            const basketItems = [];
            let outofstock = false;
            actualCart.forEach(item => {
                item.tax = parseInt(products[item.product_id].tax);
                item.subtotal = Math.round(parseFloat(products[item.product_id].price) / (1 + (parseInt(item.tax) / 100)) * 100) / 100;
                item.taxAmount = parseFloat(products[item.product_id].price) - (Math.round(item.subtotal*100)/100);
                const itemFormat = {
                    id: item.product_id,
                    price: item.product_price,
                    name: item.product_name,
                    category1: products[item.product_id].parent_category_name,
                    category2: products[item.product_id].category_name,
                    itemType: "PHYSICAL",
                };
                if (products[item.product_id].stock - item.quantity < 0) outofstock = true;
                products[item.product_id].stock -= item.quantity;
                for (let i = 0; i < item.quantity; i++) {
                    basketItems.push(itemFormat);
                }
            });
            if (outofstock) return { s: 409, j: true, d: { success: false, e: { what: "Shopping Cart", why: "Some products in the cart are out of stock", resolution: "Please confirm your cart contents and then try again." } } };

            async function parseAddress(result, token) {
                if (result.success) {
                    if (result.addresses.length === 0) return { s: false, e: "Address not found" };
                    const addr = result.addresses[0];
                    try {
                        if (token != addr.id) return { s: false, e: "Address token mismatch" };
                        addr.address = aes.pjs(addr.address);
                        if (addr.address.e && addr.address.e.startsWith("Failed to parse JSON: ")) return { s: false, e: "Malformed data on database" };
                        const decrypted = aes.decrypt(addr.address, currentUser.id);
                        if (!decrypted.s) return { s: false, e: "Failed to decrypt data on database" };
                        const address = aes.pjs(decrypted.value);
                        if (address.e && address.e.startsWith("Failed to parse JSON: ")) return { s: false, e: "Malformed decrypted data found on database" };
                        if (typeof address !== "object" || !address.name || !address.surname || !address.address || !address.city || !address.province || !address.country || !address.zip || !address.phone) {
                            return { s: false, e: "Address data is not a valid address" };
                        }
                        return { s: true, address: address };
                    } catch (err) {
                        console.error("Decrypt address error:", err);
                        return { s: false, e: err.toString() };
                    }
                }
                else {
                    return { s: false, e: "Unknown error" };
                }
            }
            function parseAddressError(err) {
                console.error("Get addresses error:", err);
                if (err instanceof sql.DBError) return { s: false, e: err.error || "Unknown error" };
                else return { s: false, e: "Unknown error" };
            }

            // Shipping Address Validation
            const shippingRecords = (shippingToken) ? await sql.getAddresses(currentUser.id, shippingToken).then(async result => { return await parseAddress(result, shippingToken); }).catch(err => { return parseAddressError(err); }) : { s: false, e: "No token provided" };
            if (!shippingToken && !shippingRecords.s) return { s: 500, j: true, d: { success: false, e: { what: "Shipping Address", why: "Failed to retrieve shipping address information: " + shippingRecords.e, resolution: "Please choose a different address or edit your saved addresses and try again." } } };
            const shippingAddress = (shippingRecords.s) ? shippingRecords.address : {
                name: checkTrim(body.data.shipping.name),
                surname: checkTrim(body.data.shipping.surname),
                address: checkTrim(body.data.shipping.address),
                address2: checkTrim(body.data.shipping.address2),
                city: checkTrim(body.data.shipping.city),
                province: checkTrim(body.data.shipping.province),
                country: checkTrim(body.data.shipping.country),
                zip: checkTrim(body.data.shipping.zip),
                phone: checkTrim(body.data.shipping.phone)
            };
            if (!shippingAddress.name || !shippingAddress.surname || !shippingAddress.address || !shippingAddress.city || !shippingAddress.country || !shippingAddress.zip || !shippingAddress.phone || !shippingAddress.province) return { s: 400, j: true, d: { success: false, e: { what: "Shipping Address", why: "Shipping address data is incomplete.", resolution: "Please fill in all required fields or edit your saved addresses to include all necessary information and try again." } } };

            // Billing Address Validation
            const billingRecords = (billingToken) ? ((billingToken !== "shipping") ? await sql.getAddresses(currentUser.id, billingToken).then(async result => { return await parseAddress(result, billingToken); }).catch(err => { return parseAddressError(err); }) : { s: false, e: "Will use shipping address" }) : { s: false, e: "No token provided" };
            if (!billingToken && !billingRecords.s && billingToken !== "shipping") return { s: 500, j: true, d: { success: false, e: { what: "Billing Address", why: "Failed to retrieve billing address information: " + billingRecords.e, resolution: "Please choose a different address or edit your saved addresses and try again." } } };

            const billingAddress = (billingToken === "shipping") ? shippingAddress : ((shippingRecords.s) ? shippingRecords.address : {
                name: checkTrim(body.data.billing.name),
                surname: checkTrim(body.data.billing.surname),
                address: checkTrim(body.data.billing.address),
                address2: checkTrim(body.data.billing.address2),
                city: checkTrim(body.data.billing.city),
                province: checkTrim(body.data.billing.province),
                country: checkTrim(body.data.billing.country),
                zip: checkTrim(body.data.billing.zip),
                phone: checkTrim(body.data.billing.phone)
            });
            if (billingToken !== "shipping" && (!billingAddress.name || !billingAddress.surname || !billingAddress.address || !billingAddress.city || !billingAddress.country || !billingAddress.zip || !billingAddress.phone || !billingAddress.province)) return { s: 400, j: true, d: { success: false, e: { what: "Billing Address", why: "Billing address data is incomplete.", resolution: "Please fill in all required fields or edit your saved addresses to include all necessary information and try again." } } };


            // Credit Card Validation
            if (!body.data.card) return { s: 400, j: true, d: { success: false, e: { what: "Credit Card", why: "Card details are missing", resolution: "Please provide valid card details" } } };
            const currentToken = Boolean(body.data.card.token) ? await getCardToken(currentUser.id) : null;
            if (currentToken && !currentToken.done) return { s: 500, j: true, d: { success: false, e: { what: "Credit Card", why: "Failed to retrieve stored card information: " + currentToken.error, resolution: "Please try again later, edit your card details within your account or contact the developers" } } };
            let card = body.data.card.token ? {
                "cardUserKey": currentToken.value,
                "cardToken": body.data.card.token,
                "cvc": body.data.card.cvc,
            } : validateCreditCard(body.data.card);
            if (!body.data.card.token && !card.valid) return { s: 400, j: true, d: { success: false, e: { what: "Credit Card", why: "Invalid card details: " + card.error, resolution: "Please provide valid card details" } } };
            else if (!body.data.card.token) card = card.card;
            let cardDetails = {};
            if (currentToken) {
                const response = await IyzipayAPI(config, "POST", "cardstorage/cards", {}, { locale: "en", cardUserKey: currentToken.value });
                if (response) {
                    if (response.status === "success" && response.cardDetails) {
                        const currentCards = response.cardDetails.filter(cd => cd.cardToken === body.data.card.token).map(cd => ({ id: cd.cardToken, alias: cd.cardAlias, last4dig: cd.lastFourDigits, binNumber: cd.binNumber, ...getCardDetailsFromResponse(cd,null) }));
                        if (currentCards.length === 0) return { s: 409, j: true, d: { success: false, e: { what: "Credit Card", why: "Saved card not found", resolution: "Please choose a valid card from your saved cards or manually enter your card details" } } };
                        else cardDetails = currentCards[0];
                    }
                    else return { s: 500, j: true, d: { success: false, e: { what: "Credit Card", why: "Failed to retrieve cards from payment provider: " + response.errorMessage, resolution: "Please try again later or contact the developers" } } };
                }
                else return { s: 500, j: true, d: { success: false, e: { what: "Credit Card", why: "An unknown error occurred while communicating with the payment provider", resolution: "Please try again later or contact the developers" } } };
            }
            // Installment Validation
            const insresponse = await IyzipayAPI(config, "POST", "payment/iyzipos/installment", {}, { locale: "en", price: totalPrice, binNumber: currentToken ? cardDetails.binNumber : body.data.card.number.substring(0, 8) });
            if (insresponse) {
                if (insresponse.status === "success") {
                    if (insresponse.installmentDetails && insresponse.installmentDetails[0]) {
                        if (!currentToken) {
                            cardDetails = { ...getCardDetailsFromResponse(insresponse.installmentDetails[0], null), agriculture: insresponse.agricultureEnabled === 1 ? true : false };
                        }
                        cardDetails.agriculture = insresponse.agricultureEnabled === 1 ? true : false;
                        cardDetails.features = { force3DS: insresponse.installmentDetails[0].force3ds === 1 ? true : false, forceCVC: insresponse.installmentDetails[0].forceCvc === 1 ? true : false, DCCEnabled: insresponse.installmentDetails[0].dccEnabled === 1 ? true : false };
                        cardDetails.installments = (insresponse.installmentDetails[0].installmentPrices) ? insresponse.installmentDetails[0].installmentPrices.map(x => ({ months: x.installmentNumber, total: x.totalPrice, permonth: x.installmentPrice })) : [];
                    }
                    else return { s: 500, j: true, d: { success: false, e: { what: "Installments", why: "No installment details found for this card", resolution: "Please try a different card or contact the developers" } } };
                }
                else {
                    return { s: 400, j: true, d: { success: false, e: { what: "Installments", why: "Failed to fetch details from payment provider", resolution: "Please try a different card or contact the developers" } } };
                }
            }
            else {
                return { s: 500, j: true, d: { success: false, e: { what: "Installments", why: "An unknown error occurred while communicating with the payment provider", resolution: "Please try again later or contact the developers" } } };
            }
            if (body.data.installments && (!cardDetails.installments || !cardDetails.installments.find(ins => ins.months === parseInt(body.data.installments)))) return { s: 400, j: true, d: { success: false, e: { what: "Installments", why: "Selected installment option is not available for this card", resolution: "Please select a valid installment option or pay in full if not applicable" } } };
            // All validations passed, create order and initiate payment
            const payload = await createOrder(config, currentUser, actualCart, basketItems, totalPrice, shippingAddress, billingAddress, card, cardDetails, body.data.installments, body.data.currency);
            if (!payload.s) return { s: 500, j: true, d: { success: false, e: { what: "Order Creation", why: "Failed to create order", resolution: "Please try again later or contact the developers" } } };
            const tvoyBank = cardDetails.bank || "your bank";
            let tryIn3DS = true;
            if (body.data.avoid3DS && !cardDetails.features.force3DS) tryIn3DS = false;
            if (!tryIn3DS) {
                const response = await IyzipayAPI(config, "POST", "payment/auth", {}, payload.p);
                let failed = false;
                if (response) {
                    if (response.status === "success") {
                        const authChecker = await IyzipayAPI(config, "POST", "payment/detail", {}, { locale: "en", paymentId: response.paymentId });
                        if (authChecker) {
                            if (authChecker.status === "success") {
                                if (authChecker.paymentStatus === "SUCCESS") {
                                    const orderNumber = await sql.reserveOrderNumber(currentUser.id, payload.o.details).then(result => {
                                        if (result.success) return { s: true, n: result.oID };
                                        else return { s: false, e: "An unknown error occurred" };
                                    }).catch(err => {
                                        console.error("Get order number error:", err);
                                        if (err instanceof sql.DBError) return { s: false, e: err.error || "An unknown error occurred" };
                                        else return { s: false, e: "An unknown error occurred" };
                                    });
                                    if (!orderNumber.s) return { s: false, e: "Create order failed: " + orderNumber.e || "An unknown error occurred during order creation" };
                                    const updateResult = await sql.updateOrderStatus(orderNumber.n, "confirmed", response.paymentId).then(result => {
                                        if (result.success) return { s: true };
                                        else return { s: false, e: "An unknown error occurred" };
                                    }).catch(err => {
                                        console.error("Update order status error:", err);
                                        if (err instanceof sql.DBError) return { s: false, e: err.error || "An unknown error occurred" };
                                        else return { s: false, e: "An unknown error occurred" };
                                    });
                                    if (!updateResult.s) return { s: 500, j: true, d: { success: false, e: { what: "Order Confirmation", why: "Order update failed: " + updateResult.e, resolution: "Please contact the developers. YOUR CARD HAS ALREADY BEEN CHARGED" } } };
                                    await completeCart(payload.o.detailsOpen.products);
                                    await sql.clearCart(currentUser.id).then(result => {}).catch(err => {});
                                    await emailInvoice(currentUser.username, orderNumber.n, payload.o.detailsOpen);
                                    return { s: 200, j: true, d: { success: true, orderNumber: orderNumber.n, response: authChecker } };
                                }
                                else return { s: 400, j: true, d: { success: false, e: { what: "Payment Processor", why: "Payment status is not complete yet. Currently showing as " + authChecker.paymentStatus, resolution: "Please wait for a few minutes and check the orders page." } } };
                            }
                            else {
                                failed = true;
                                if (authChecker.errorGroup === "DEBIT_CARDS_REQUIRES_3DS") { failed = false; tryIn3DS = true; }
                                const errObj = PaymentError(authChecker.errorGroup, authChecker.errorMessage, tvoyBank);
                                if (failed) return { s: 400, j: true, d: { success: false, e: { what: "Payment Processor", why: errObj.why, resolution: errObj.resolution } } };
                            }
                        }
                        else return { s: 500, j: true, d: { success: false, e: { what: "Payment Processor", why: "An unknown error occurred while confirming the transaction", resolution: "Please wait a few minutes. DON'T TRY AGAIN IMMEDIATELY. YOUR CARD MIGHT HAVE ALREADY BEEN CHARGED" } } };
                    }
                    else {
                        failed = true;
                        if (response.errorGroup === "DEBIT_CARDS_REQUIRES_3DS") { failed = false; tryIn3DS = true; }
                        const errObj = PaymentError(response.errorGroup, response.errorMessage, tvoyBank);
                        if (failed) return { s: 400, j: true, d: { success: false, e: { what: "Payment Processor", why: errObj.why, resolution: errObj.resolution } } };
                    }
                }
                else return { s: 500, j: true, d: { success: false, e: { what: "Payment Processor", why: "An unknown error occurred while communicating with the payment provider", resolution: "Please try again later or contact the developers" } } };
            }
            if (tryIn3DS) {
                const random = await generateToken();
                payload.p.conversationId = random;
                const response = await IyzipayAPI(config, "POST", "payment/3dsecure/initialize", {}, payload.p);
                if (response) {
                    if (response.status === "success") {
                        payload.o.payment = response.paymentId;
                        payload.o.timeout = new Date().getTime() + (10 * 60 * 1000);
                        tokens.set(random, payload.o);
                        return { s: 202, j: true, d: { success: true, redirect3DS: true, e: { what: "Payment Processor", why: "3D Secure authentication is initiated", resolution: "You will be sent to " + tvoyBank + "'s payment page to complete the transaction." }, target: "data:text/html;base64," + response.threeDSHtmlContent } };
                    }
                    else {
                        const errObj = PaymentError(response.errorGroup, response.errorMessage, tvoyBank);
                        return { s: 400, j: true, d: { success: false, e: { what: "Payment Processor", why: errObj.why, resolution: errObj.resolution } } };
                    }
                }
                else return { s: 500, j: true, d: { success: false, e: { what: "Payment Processor", why: "An unknown error occurred while communicating with the payment provider", resolution: "Please try again later or contact the developers" } } };
            }
            else return { s: 500, j: true, d: { success: false, e: { what: "Payment Processor", why: "Failed to process payment", resolution: "Please try again later or contact the developers" } } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else if (endpoint[0] === "3dscallback") {
        function CallbackEmbed(obj) {
            return { s: 302, j: false, d: "", h: { "Location": "https://" + config.domain + "/checkout/3dscallback?result="+Buffer.from(JSON.stringify(obj)).toString("base64") } };
        }
        if (method === "POST") {
            if (headers.origin != config.iyzipay.api && headers.referrer != config.iyzipay.api+"/") return CallbackEmbed({ s: 403, j: true, d: { success: false, e: { what: "Information", why: "Invalid request body", resolution: "Please do not try to navigate back and forth during the transaction." }}});
            if (!body || body.json || !body.exists) return CallbackEmbed({ success: false, e: { what: "Information", why: "Invalid request body", resolution: "Please do not try to navigate back and forth during the transaction." } });
            body.data = body.data.split("&").map(pair => {
                const p = pair.split("=");
                return { key: p[0], value: p[1] };
            });
            let form = {};
            body.data.forEach(pair => {
                form[pair.key] = pair.value;
            });
            if (form.status && form.status === "success" && form.mdStatus !== undefined && form.mdStatus === "1" && form.conversationId && form.paymentId) {
                let why = "TIMEOUT";
                let details = null;
                let detailsEnc = null;
                let user = null;
                for (const [token, info] of tokens) {
                    if (!info || typeof info.timeout !== "number" || info.timeout <= new Date().getTime()) {
                        if (token == form.conversationId) why = "TIMEOUT";
                        tokens.delete(token);
                    }
                }
                if (tokens.has(form.conversationId)) {
                    const orderInfo = tokens.get(form.conversationId);
                    if (orderInfo.payment !== form.paymentId) {
                        tokens.delete(form.conversationId);
                        why = "PAYMENT_ID_MISMATCH";
                    }
                    else if (orderInfo.details) {
                        detailsEnc = orderInfo.details;
                        user = orderInfo.user;
                        details = aes.pjs(detailsEnc);
                        if (details.e && details.e.startsWith("Failed to parse JSON: ")) {
                            tokens.delete(form.conversationId);
                            why = "MALFORMED_ORDER_DETAILS";
                        }
                        else {
                            details = aes.decrypt(details, user);
                            if (!details.s) {
                                tokens.delete(form.conversationId);
                                why = "FAILED_TO_DECRYPT_ORDER_DETAILS";
                            }
                            else {
                                details = aes.pjs(details.value);
                                if (details.e && details.e.startsWith("Failed to parse JSON: ")) {
                                    tokens.delete(form.conversationId);
                                    why = "MALFORMED_DECRYPTED_ORDER_DETAILS";
                                }
                            }
                        }
                    }
                }
                if (!tokens.has(form.conversationId)) {
                    if (why == "TIMEOUT") return CallbackEmbed({ success: false, e: { what: "Payment Processor", why: "Transaction's 3D Secure session has timed out", resolution: "Please try again later." } });
                    if (why == "PAYMENT_ID_MISMATCH") return CallbackEmbed({ success: false, e: { what: "3D Secure Callback", why: "Transaction's 3D Secure context cannot be verified", resolution: "Please try again later or contact the developers with the payment ID: " + form.paymentId } });
                    if (why == "MALFORMED_ORDER_DETAILS") return CallbackEmbed({ success: false, e: { what: "3D Secure Callback", why: "Transaction's 3D Secure context couldn't be internally accessed", resolution: "Please try again later or contact the developers with the payment ID: " + form.paymentId } });
                    if (why == "FAILED_TO_DECRYPT_ORDER_DETAILS") return CallbackEmbed({ success: false, e: { what: "3D Secure Callback", why: "Transaction's 3D Secure context couldn't be internally accessed", resolution: "Please try again later or contact the developers with the payment ID: " + form.paymentId } });
                    if (why == "MALFORMED_DECRYPTED_ORDER_DETAILS") return CallbackEmbed({ success: false, e: { what: "3D Secure Callback", why: "Transaction's 3D Secure context couldn't be internally accessed", resolution: "Please try again later or contact the developers with the payment ID: " + form.paymentId } });
                }
                if (!details) return CallbackEmbed({ success: false, e: { what: "3D Secure Callback", why: "Transaction's 3D Secure context couldn't be accessed", resolution: "Please try again later or contact the developers with the payment ID: " + form.paymentId } });
                let payload = { locale: "en", paymentId: form.paymentId, conversationId: form.conversationId, basketId: details.products[0].id, currency: details.currency, paidPrice: details.price.paid };
                if (form.conversationData) payload.conversationData = form.conversationData;
                if (tokens.has(form.conversationId)) tokens.delete(form.conversationId);
                const response = await IyzipayAPI(config, "POST", "payment/v2/3dsecure/auth", {}, payload);
                if (response) {
                    if (response.status === "success") {
                        const authChecker = await IyzipayAPI(config, "POST", "payment/detail", {}, { locale: "en", paymentId: form.paymentId });
                        if (authChecker) {
                            if (authChecker.status === "success") {
                                if (authChecker.paymentStatus === "SUCCESS") {
                                    const orderNumber = await sql.reserveOrderNumber(user, detailsEnc).then(result => {
                                        if (result.success) return { s: true, n: result.oID };
                                        else return { s: false, e: "An unknown error occurred" };
                                    }).catch(err => {
                                        console.error("Get order number error:", err);
                                        if (err instanceof sql.DBError) return { s: false, e: err.error || "An unknown error occurred" };
                                        else return { s: false, e: "An unknown error occurred" };
                                    });
                                    if (!orderNumber.s) return { s: false, e: "Create order failed: " + orderNumber.e || "An unknown error occurred during order creation" };
                                    const updateResult = await sql.updateOrderStatus(orderNumber.n, "confirmed", form.paymentId).then(result => {
                                        if (result.success) return { s: true };
                                        else return { s: false, e: "An unknown error occurred" };
                                    }).catch(err => {
                                        console.error("Update order status error:", err);
                                        if (err instanceof sql.DBError) return { s: false, e: err.error || "An unknown error occurred" };
                                        else return { s: false, e: "An unknown error occurred" };
                                    });
                                    if (!updateResult.s) return CallbackEmbed({ success: false, e: { what: "Order Confirmation", why: "Order update failed: " + updateResult.e, resolution: "Please contact the developers. YOUR CARD HAS ALREADY BEEN CHARGED" } });
                                    await completeCart(details.products);
                                    await sql.clearCart(user).then(result => {}).catch(err => {});
                                    await emailInvoice(currentUser.username, orderNumber.n, details);
                                    return CallbackEmbed({ success: true, orderNumber: orderNumber.n, response: authChecker });
                                }
                                else return CallbackEmbed({ success: false, e: { what: "Payment Processor", why: "Payment status is not complete yet. Currently showing as " + authChecker.paymentStatus, resolution: "Please wait for a few minutes and check the orders page." } });
                            }
                            else {
                                const errObj = PaymentError(authChecker.errorGroup, authChecker.errorMessage, "your bank");
                                return CallbackEmbed({ success: false, e: { what: "Payment Processor", why: errObj.why, resolution: errObj.resolution } });
                            }
                        }
                        else return CallbackEmbed({ success: false, e: { what: "Payment Processor", why: "An unknown error occurred while confirming the transaction", resolution: "Please wait a few minutes. DON'T TRY AGAIN IMMEDIATELY. YOUR CARD MIGHT HAVE ALREADY BEEN CHARGED" } });
                    }
                    else {
                        const errObj = PaymentError(response.errorGroup, response.errorMessage, "your bank");
                        return CallbackEmbed({ success: false, e: { what: "Payment Processor", why: errObj.why, resolution: errObj.resolution } });
                    }
                }
                else return CallbackEmbed({ success: false, e: { what: "Payment Processor", why: "An unknown error occurred while communicating with the payment provider", resolution: "Please try again later or contact the developers" } });
            }
            else if (form.status && form.status === "failure" && form.mdStatus !== undefined && form.mdStatus !== "1" && form.conversationId) {
                const errObj = {
                    "-1": { why: "3D Secure invalid or cancelled", res: "Please try again. If the problem persists, please contact your bank or try a different card." },
                    "0": { why: "3D Secure invalid or cancelled", res: "Please try again. If the problem persists, please contact your bank or try a different card." },
                    "2": { why: "Cardholder or bank not registered to 3DS", res: "If possible, register your card to 3D Secure through your bank and then try again. If your card is already registered, please contact your bank for more information." },
                    "3": { why: "Bank not participating in 3DS", res: "Please use a different card from a different bank or contact your bank for more information." },
                    "4": { why: "Cardholder registered to 3DS after transaction", res: "Please try again. If the problem persists, please contact your bank or try a different card." },
                    "5": { why: "Unable to verify", res: "Please try again. If the problem persists, please contact your bank or try a different card." },
                    "6": { why: "3DS Error", res: "Please try again. If the problem persists, please contact your bank or try a different card." },
                    "7": { why: "Payment Processor Error", res: "Please try again. If the problem persists, please contact the developers." },
                    "8": { why: "Unknown Card Number", res: "Please use a different card and try again." }
                }[form.mdStatus]
                return CallbackEmbed({ success: false, e: { what: "Payment Processor", why: errObj.why, resolution: errObj.res } });
            }
            else {
                return CallbackEmbed({ success: false, e: { what: "Information", why: "Invalid request body", resolution: "Please do not try to navigate back and forth during the transaction." } });
            }
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
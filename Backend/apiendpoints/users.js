const sql = require("../../Database/server.js");
const aes = require("../components/aes256.js");
function taxIDType(taxId) {
    taxId = taxId.trim();
    if (taxId === "11111111111") return { s: false, t: "Turkish ID", e: "Invalid Number." };
    if (!taxId || taxId.trim().length === 0) return { s: true, t: "None", e: "Tax ID is empty" };
    if (taxId.length > 11) return { s: false, t: "unknown", e: "Tax ID must be 11 characters or fewer" };

    const mightBeTC = taxId.length === 11 && /^\d+$/.test(taxId);
    const mightBeVKN = taxId.length === 10 && /^\d+$/.test(taxId);
    const mightBePassport = taxId.length >= 6 && taxId.length <= 9 && /^[a-zA-Z0-9]+$/.test(taxId);

    if (mightBeTC) {
        const digits = taxId.split('').map(Number)
        const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
        const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
        const expectedTenthDigit = (((oddSum * 7) - evenSum) % 10 + 10) % 10
        const expectedEleventhDigit = digits.slice(0, 10).reduce((total, digit) => total + digit, 0) % 10
        const isForeigner = taxId[0] === "9";
        if (digits[0] === 0) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        if (digits[9] !== expectedTenthDigit) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        if (digits[10] !== expectedEleventhDigit) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        return { s: true, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID" };
    }
    else if (mightBeVKN) {
        const digits = taxId.split('').map(Number)
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            let value = ((digits[i] + (9 - i)) % 10) === 0 ? 0 : 10 - ((digits[i] + (9 - i)) % 10);
            let check = (value * Math.pow(2, 9 - i)) % 9;
            if (value > 0 && check === 0) check = 9;
            sum += check;
        }
        const expectedTenthDigit = (sum % 10) === 0 ? 0 : 10 - (sum % 10);
        if (expectedTenthDigit !== parseInt(taxId[9], 10)) return { s: false, t: "Turkish Corporate Tax ID", e: "Invalid Number" };
        else return { s: true, t: "Turkish Corporate Tax ID" };
    }
    else if (mightBePassport) {
        return { s: true, t: "Passport Number" };
    }
    else {
        return { s: false, t: "unknown", e: "Invalid Tax ID format" };
    }
}
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e) {
        console.log("Unauthorized access: " + currentUser.e);
        return { s: 401, j: true, d: { e: "Unauthorized" } };
    }
    if (endpoint[0] === "me") {
        if (currentUser.tax_id && currentUser.tax_id.length > 0) {
            currentUser.tax_id = aes.pjs(currentUser.tax_id);
            if (currentUser.tax_id.e && currentUser.tax_id.e.startsWith("Failed to parse JSON: ")) {
                currentUser.tax_id = null;
                currentUser.tax_id_error = "Failed to parse tax ID data, possibly due to legacy format. Please update your tax ID in your profile settings.";
            }
        }
        currentUser.tax_id = aes.decrypt(currentUser.tax_id, currentUser.id);
        if (!currentUser.tax_id.s || currentUser.tax_id.e) {
            console.error("Decryption error:", currentUser.tax_id.e);
            currentUser.tax_id = null;
            currentUser.tax_id_error = "Failed to decrypt tax ID. Please update your tax ID in your profile settings.";
        }
        else currentUser.tax_id = currentUser.tax_id.value;
        const taxIDInfo = taxIDType(currentUser.tax_id);
        if (!taxIDInfo.s) {
            currentUser.tax_id_type = taxIDInfo.t || "unknown";
            currentUser.tax_id_error = taxIDInfo.e;
            currentUser.tax_id = null;
        }
        else currentUser.tax_id_type = taxIDInfo.t;
        // We don't want to expose the tax ID in the GET endpoint, but we will still accept it in the PATCH endpoint for updating it.
        if (method === "GET") {
            if (currentUser.tax_id && currentUser.tax_id.length > 0) {
                function RepeatStar(n) {
                    let str = "";
                    for (let i = 0; i < n - 2; i++) str += "*";
                    return str;
                }
                currentUser.tax_id = currentUser.tax_id.substring(0, 1) + RepeatStar(currentUser.tax_id.length) + currentUser.tax_id.substring(currentUser.tax_id.length - 1);
            }
            return { s: 200, j: true, d: { user: currentUser } };
        }
        else if (method === "PATCH") {
            if (!body || !body.exists || body.err || !body.json || !body.data || ((!body.data.name || !body.data.privacy) && body.data.emailblock === undefined && body.data.taxId === undefined)) return { s: 400, j: true, d: { e: "Invalid request body" } };
            if ((body.data.name && !body.data.privacy) || (!body.data.name && body.data.privacy)) return { s: 400, j: true, d: { e: "Display name and privacy must be provided together" } };
            if (!body.data.name && !body.data.privacy) {
                body.data.name = currentUser.displayname;
                body.data.privacy = currentUser.nameprivacy;
            }
            else {
                if (body.data.name.trim().split(" ").length < 2) return { s: 400, j: true, d: { e: "Please enter your name and surname" } };
                const userwords = body.data.name.split(" ").map(s => s.trim()).filter(s => s.length > 0);
                let privacyinvalid = false;
                const userprivacy = body.data.privacy.split("").map(s => {
                    if (!["s", "h", "i"].includes(s)) privacyinvalid = true;
                    return privacyinvalid ? null : { "s": "SHOW", "h": "HIDE", "i": "INITIAL" }[s];
                })
                if (userprivacy.length === 0) return { s: 400, j: true, d: { e: "Privacy setting is required" } };
                if (userprivacy.length !== userwords.length) return { s: 400, j: true, d: { e: "Privacy setting length must match the number of words in your display name" } };
                if (privacyinvalid) return { s: 400, j: true, d: { e: "Invalid privacy setting" } };
            }
            let taxId = (body.data.taxId === undefined ? currentUser.tax_id : (body.data.taxId.trim().length === 0 ? null : body.data.taxId.trim()));
            taxIDInfo = taxIDType(taxId);
            if (!taxIDInfo.s && currentUser.tax_id) return { s: 400, j: true, d: { e: "Invalid Tax ID: " + ((taxIDInfo.t !== "unknown" && taxIDInfo.t) ? "(Might be " + taxIDInfo.t + ") " : "") + taxIDInfo.e } };
            if (taxId && taxId.length > 0) {
                taxId = aes.encrypt(taxId, currentUser.id);
                if (taxId.e) {
                    console.error("Encryption error:", taxId.e);
                    return { s: 500, j: true, d: { e: "Internal server error" } };
                }
                taxId = JSON.stringify(taxId);
            }
            return await sql.editUser(currentUser.id, body.data.name, body.data.privacy, body.data.emailblock === undefined ? currentUser.emailblock : body.data.emailblock, taxId || null).then(res => {
                if (res.success) {
                    return { s: 200, j: true, d: { e: "User updated successfully" } };
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
        else if (method === "DELETE") {
            // DO NOT UNCOMMENT THIS CODE WITHOUT IMPLEMENTING PROPER SECURITY MEASURES. THIS IS INTENTIONALLY COMMENTED OUT TO PREVENT ACCIDENTAL USE.

            // return await sql.deleteUser(currentUser.id).then(res => {
            //     if (res.success) {
            //         return { s: 200, j: true, d: { msg: res.message } };
            //     }
            //     else {
            //         return { s: 500, j: true, d: { e: "Internal server error" } };
            //     }
            // }).catch(err => {
            //     if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error } };
            //     return { s: 500, j: true, d: { e: "Internal server error" } };
            // });
            return { s: 501, j: true, d: { e: "Not Implemented yet" } };
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 400, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };

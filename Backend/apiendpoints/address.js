const sql = require("../../Database/server.js");
const crypto = require("crypto");
const aes = require("../components/aes256.js");
function checkTrim(x) {
    if (x === undefined || x === null) return undefined;
    if (typeof x !== "string") return undefined;
    const trimmed = x.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
    if (endpoint.length === 0) {
        if (method === "GET") {
            const specificaddress = Boolean(query.id) ? query.id : null;
            return await sql.getAddresses(currentUser.id, specificaddress).then(async result => {
                if (result.success) {
                    const errors = [];
                    const addresses = result.addresses.map(addr => {
                        try {
                            if (specificaddress && specificaddress != addr.id) return undefined;
                            addr.address = aes.pjs(addr.address);
                            if (addr.address.e && addr.address.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on database");
                            const decrypted = aes.decrypt(addr.address, currentUser.id);
                            if (!decrypted.s) throw new Error("Decryption failed");
                            const address = aes.pjs(decrypted.value);
                            if (address.e && address.e.startsWith("Failed to parse JSON: ")) throw new Error("Malformed data found on decrypted database");
                            if (typeof address !== "object" || !address.name || !address.surname || !address.address || !address.city || !address.province || !address.country || !address.zip || !address.phone) {
                                throw new Error("Decrypted data is not a valid address");
                            }
                            return specificaddress ? { id: addr.id, ...address } : { id: addr.id, title: address.alias ? address.alias : address.address.includes(",") ? address.address.split(",")[0] : address.address.split(" ").slice(0, 3).join(" "), desc: address.city + ", " + address.province + ", " + address.country };
                        } catch (err) {
                            console.error("Decrypt address error:", err);
                            errors.push({ id: addr.id, e: err.toString() });
                            return { address: undefined, e: err.toString() };
                        }
                    }).filter(addr => addr !== undefined);
                    if (addresses.length === 0 && specificaddress) return { s: 404, j: true, d: { e: "Address not found" } };
                    return specificaddress ? { s: 200, j: true, d: { address: addresses[0] } } : { s: 200, j: true, d: { addresses, errors } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Get addresses error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "POST") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.address) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const address = {
                alias: checkTrim(body.data.address.alias),
                name: checkTrim(body.data.address.name),
                surname: checkTrim(body.data.address.surname),
                address: checkTrim(body.data.address.address),
                address2: checkTrim(body.data.address.address2),
                city: checkTrim(body.data.address.city),
                province: checkTrim(body.data.address.province),
                country: checkTrim(body.data.address.country),
                zip: checkTrim(body.data.address.zip),
                phone: checkTrim(body.data.address.phone)
            }
            if (!address.name || !address.surname || !address.address || !address.city || !address.country || !address.zip || !address.phone || !address.province) return { s: 400, j: true, d: { e: "Missing required address fields" } };
            const addressEnc = aes.encrypt(JSON.stringify(address), currentUser.id);
            return await sql.saveAddress(currentUser.id, JSON.stringify(addressEnc)).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: "Address added successfully" } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Add address error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "PATCH") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id || !body.data.address) return { s: 400, j: true, d: { e: "Invalid request body" } };
            const address = {
                alias: checkTrim(body.data.address.alias),
                name: checkTrim(body.data.address.name),
                surname: checkTrim(body.data.address.surname),
                address: checkTrim(body.data.address.address),
                address2: checkTrim(body.data.address.address2),
                city: checkTrim(body.data.address.city),
                province: checkTrim(body.data.address.province),
                country: checkTrim(body.data.address.country),
                zip: checkTrim(body.data.address.zip),
                phone: checkTrim(body.data.address.phone)
            }
            if (!address.name || !address.surname || !address.address || !address.city || !address.country || !address.zip || !address.phone || !address.province) return { s: 400, j: true, d: { e: "Missing required address fields" } };
            const addressEnc = aes.encrypt(JSON.stringify(address), currentUser.id);
            return await sql.editAddress(currentUser.id, body.data.id, JSON.stringify(addressEnc)).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: "Address updated successfully" } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Edit address error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else if (method === "DELETE") {
            if (!body || !body.exists || body.err || !body.json || !body.data || !body.data.id) return { s: 400, j: true, d: { e: "Invalid request body" } };
            return await sql.deleteAddress(currentUser.id, body.data.id).then(async result => {
                if (result.success) {
                    return { s: 200, j: true, d: { msg: "Address deleted successfully" } };
                }
                else {
                    return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                }
            }).catch(err => {
                console.error("Delete address error:", err);
                if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
            });
        }
        else return { s: 405, j: true, d: { e: "Method Not Allowed" } };
    }
    else return { s: 404, j: true, d: { e: "Not Found" } };
}
module.exports = { handleAPI };
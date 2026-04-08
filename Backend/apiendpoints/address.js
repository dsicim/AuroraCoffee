const sql = require("../../Database/server.js");
const crypto = require("crypto");
const aes = require("../aes256.js");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (!currentUser || currentUser.e || !currentUser.id) return { s: 401, j: true, d: { e: "Unauthorized" } };
    if (endpoint.length === 0) {
        if (method === "GET") {
            const specificaddress = Boolean(query.id) ? query.id : null;
            return await sql.getAddresses(currentUser.id, specificaddress).then(async result => {
                if (result.success) {
                    const addresses = result.addresses.map(addr => {
                        try {
                            if (specificaddress && specificaddress != addr.id) return undefined;
                            const decrypted = aes.decrypt(addr.address);
                            if (!decrypted.s) throw new Error("Decryption failed");
                            const address = JSON.parse(decrypted.value);
                            if (typeof address !== "object" || !address.name || !address.surname || !address.address || !address.city || !address.province || !address.country || !address.zip || !address.phone) {
                                throw new Error("Decrypted data is not a valid address");
                            }
                            return { id: addr.id, title: address.alias || address.address.split(" ")[0], desc: address.city + ", " + address.province + ", " + address.country };
                        } catch (err) {
                            console.error("Decrypt address error:", err);
                            return { address: undefined, e: err.toString() };
                        }
                    }).filter(addr => addr.address !== undefined);
                    if (addresses.length === 0 && specificaddress) return { s: 404, j: true, d: { e: "Address not found" } };
                    return specificaddress ? { s: 200, j: true, d: { address: addresses[0] } } : { s: 200, j: true, d: { addresses } };
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
                alias: body.data.address.alias.trim() || undefined,
                name: body.data.address.name.trim(),
                surname: body.data.address.surname.trim(),
                address: body.data.address.address.trim(),
                address2: body.data.address.address2.trim() || undefined,
                city: body.data.address.city.trim(),
                province: body.data.address.province.trim(),
                country: body.data.address.country.trim(),
                zip: body.data.address.zip.trim(),
                phone: body.data.address.phone.trim()
            }
            if (!address.name || !address.surname || !address.address || !address.city || !address.country || !address.zip || !address.phone || !address.province) return { s: 400, j: true, d: { e: "Missing required address fields" } };
            const addressEnc = aes.encrypt(JSON.stringify(address));
            return await sql.saveAddress(currentUser.id, addressEnc).then(async result => {
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
            body.data.address = body.data.address.map(x => typeof x === "string" ? x.trim() : x);
            const address = {
                alias: body.data.address.alias.trim() || undefined,
                name: body.data.address.name.trim(),
                surname: body.data.address.surname.trim(),
                address: body.data.address.address.trim(),
                address2: body.data.address.address2.trim() || undefined,
                city: body.data.address.city.trim(),
                province: body.data.address.province.trim(),
                country: body.data.address.country.trim(),
                zip: body.data.address.zip.trim(),
                phone: body.data.address.phone.trim()
            }
            if (!address.name || !address.surname || !address.address || !address.city || !address.country || !address.zip || !address.phone || !address.province) return { s: 400, j: true, d: { e: "Missing required address fields" } };
            const addressEnc = aes.encrypt(JSON.stringify(address));
            return await sql.editAddress(currentUser.id, body.data.id, addressEnc).then(async result => {
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
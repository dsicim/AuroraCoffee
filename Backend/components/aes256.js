const config = require("../config.json");
const crypto = require("crypto");
function pjs(text) {
    try {
        return JSON.parse(text);
    } catch (err) {
        console.error("Parse JSON error:", err);
        return { e: "Failed to parse JSON: " + err.message };
    }
}
function encrypt(plain, userId) {
    const key = Buffer.from(config.storagekey, "base64");
    try {
        const aad = Buffer.from("user:" + userId, "utf8");
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([
            cipher.update(String(plain), "utf8"),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return {
            pd: ciphertext.toString("base64"),
            iv: iv.toString("base64"),
            tg: tag.toString("base64")
        };
    }
    catch (err) {
        console.error("Encryption error:", err);
        return {
            e: "Encryption failed: " + err.message
        };
    }
}
function decrypt(encrypted, userId) {
    const key = Buffer.from(config.storagekey, "base64");
    try {
        if (!encrypted.iv || !encrypted.tg || !encrypted.pd) {
            throw new Error("Invalid encrypted data format");
        }
        const iv = Buffer.from(encrypted.iv, "base64");
        const tag = Buffer.from(encrypted.tg, "base64");
        const ciphertext = Buffer.from(encrypted.pd, "base64");
        const aad = Buffer.from("user:" + userId, "utf8");
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(aad);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return { s: true, value: plaintext.toString("utf8") };
    }
    catch (err) {
        console.error("Decryption error:", err);
        return { s:false, e: "Decryption failed: " + err.message};
    }
}
module.exports = { pjs, encrypt, decrypt };
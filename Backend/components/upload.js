const fs = require("fs");
const path = require("path");
const sql = require("../../Database/server.js");
const crypto = require("crypto");
const stream = require("stream");
const { loadEsm } = require("load-esm");
const sharp = require('sharp');

async function createUpload(user, prefName, restrictions, req, headers) {
    if (!restrictions.maxSize || isNaN(parseInt(restrictions.maxSize))) restrictions.maxSize = 10 * 1024 * 1024; // Default max size: 10 MB
    if (!restrictions.allowedTypes || !Array.isArray(restrictions.allowedTypes) || restrictions.allowedTypes.length === 0) {
        return { s: 500, e: "Server configuration error: allowedTypes must be a non-empty array" };
    }
    if (headers["content-length"] === undefined) return { s: 411, e: "Content-Length header is required" };
    if (isNaN(parseInt(headers["content-length"]))) return { s: 411, e: "Invalid Content-Length header" };
    if (parseInt(headers["content-length"]) > restrictions.maxSize) return { s: 413, e: "File size exceeds the maximum allowed size of " + (restrictions.maxSize / (1024 * 1024)) + " MB" };
    if (prefName.length > 0) prefName = prefName + "-";
    let bytesWritten = 0;
    const { fileTypeStream } = await loadEsm("file-type");
    const webStream = stream.Readable.toWeb(req);
    const ftResult = await fileTypeStream(webStream);
    const detected = ftResult.fileType;
    const passthrough = stream.Readable.fromWeb(ftResult);
    let uploadprocess
    try {

        uploadprocess = await new Promise((resolve, reject) => {
            if (!detected) {
                passthrough.resume();
                reject({ s: 415, e: "Could not detect file type" });
                return;
            }
            if (!restrictions.allowedTypes.includes(detected.mime)) {
                passthrough.resume();
                reject({ s: 415, e: "Unsupported media type. Allowed types are: " + restrictions.allowedTypes.join(", ") });
                return;
            }

            let format = detected.ext;
            let converting = null;
            if (restrictions.convertTo !== undefined && restrictions.convertTo !== null) format = restrictions.convertTo;
            if (["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/tiff", "image/avif"].includes(restrictions.convertTo)) {
                if (!["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/tiff", "image/avif"].includes(detected.mime)) {
                    passthrough.resume();
                    reject({ s: 415, e: "Unsupported media type for conversion. Allowed types are: image/png, image/jpeg, image/jpg, image/gif, image/webp, image/tiff, image/avif" });
                    return;
                }
                converting = sharp().toFormat(format, { quality: 100 });
            }
            let actualname = prefName + crypto.randomBytes(16).toString("hex").substring(0, 32);
            const uploadsDir = path.join(__dirname, "..", "..", "Database", "uploads");
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
            while (fs.existsSync(path.join(uploadsDir, actualname + "." + format))) {
                actualname = prefName + crypto.randomBytes(16).toString("hex").substring(0, 32);
            }
            const filepath = path.join(uploadsDir, actualname + "." + format);
            fs.writeFileSync(filepath, ""); // Create an empty file to reserve the name and prevent race conditions
            const fileurl = "/uploads/" + actualname + "." + format;

            const writeStream = fs.createWriteStream(filepath);

            if (converting) passthrough.pipe(converting).pipe(writeStream);
            else passthrough.pipe(writeStream);

            passthrough.on("data", (chunk) => {
                bytesWritten += chunk.length;
                if (bytesWritten > restrictions.maxSize) {
                    writeStream.destroy();
                    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                    reject({ s: 413, e: "File size exceeds the maximum allowed size of " + (restrictions.maxSize / (1024 * 1024)) + " MB" });
                    return;
                }
            });
            passthrough.on("error", (err) => {
                writeStream.destroy();
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                console.error("Error during file upload:", err);
                reject({ s: 500, e: "Internal server error" });
                return;
            });
            writeStream.on("error", () => {
                writeStream.destroy();
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                reject({ s: 500, e: "Internal server error" });
                return;
            });
            writeStream.on("finish", () => {
                resolve({ s: 200, url: fileurl, filetype: detected.mime, path: filepath });
                return;
            });
            writeStream.on("error", (err) => {
                console.error("Error writing file:", err);
                reject({ s: 500, e: "Internal server error" });
                return;
            });
        });
    }
    catch (err) {
        return err.s ? err : { s: 500, e: "Internal server error" };
    }
    if (uploadprocess.s !== 200) return { s: uploadprocess.s, e: uploadprocess.e };

    return uploadprocess;
}
module.exports = { createUpload };
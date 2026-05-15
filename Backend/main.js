const path = require('path');
const http = require('http');
const fs = require('fs');
const fetch = require('node-fetch');
const api = require("./components/api.js");
const crypto = require('crypto');
const fdir = "../Frontend/dist/";
const ddir = "../Database/";
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
const mimes = {
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "png": "image/png",
    "jpg": "image/jpg",
    "jpeg": "image/jpg",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "ico": "image/x-icon",
    "json": "application/json",
    "txt": "text/plain"
}
const uploadEndpoints = {
    "products/image": ["POST"] 
}
const server = http.createServer(async function (req, res) {
    if (!req.url.startsWith("/api/")) req.url = req.url.split("?")[0];
    if (req.url.includes("..")) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
    }
    else if (req.url.startsWith("/api/")) {
        const directory = req.url.substring(5).split("/");
        let query = directory.pop().split("?");
        directory.push(query.shift());
        if (query.length) query = query[0];
        if (query.includes("&")) {
            query = query.split("&").reduce((acc, curr) => {
                const [key, value] = curr.split("=");
                acc[key] = value;
                return acc;
            }, {});
        }
        else {
            query = query.length > 0 ? { [query.split("=")[0]]: query.split("=")[1] } : {};
        }
        const isUpload = uploadEndpoints[directory.join("/")] && uploadEndpoints[directory.join("/")].includes(req.method);
        if (!isUpload) {
            const sizeHeader = req.headers["content-length"];
            if (sizeHeader && sizeHeader > 1 * 1024 * 1024) {
                res.writeHead(413, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ e: "Request body is too large. Please shorten the JSON or text payload for this request." }));
                return;
            }
        }
        const body = isUpload ? { exists: true, json: false, data: null, err: null, upload: true, raw: req } : await new Promise((resolve, reject) => {
            let t = 0;
            let b = "";
            req.on("data", function (c) {
                b += c;
            });
            req.on("end", function () {
                if (b == "") {
                    t = 0;
                    b = null;
                }
                else {
                    try {
                        b = JSON.parse(b);
                        t = 2;
                    } catch (error) {
                        t = 1;
                    }
                }
                resolve({ exists: t !== 0, json: t === 2, data: b, err: null });
            });
            req.on("error", function (err) {
                reject(err);
            });
        }).catch(err => ({ exists: false, json: false, data: null, err: err }));
        const response = await api.handleAPI(req.method, directory, query, body, req.headers, res);
        if (response.resended) return;
        res.writeHead(response.s, { "Content-Type": (response.j ? "application/json" : (response.h ? (response.h["Content-Type"] || "text/plain") : "text/plain")), ...response.h });
        res.end(response.j ? JSON.stringify(response.d) : response.d);
        if (response.stopserver) {
            setTimeout(async () => {
                await new Promise((resolve) => {
                    server.close(() => {
                        resolve();
                    });
                });
                process.exit(0);
            }, 500);
        }
    }
    else if (req.url.startsWith("/assets/")) {
        fs.readFile(fdir + "assets/" + req.url.substring(8), function (error, data) {
            if (error) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("File not found");
            }
            else {
                res.writeHead(200, { "Content-Type": mimes[path.extname(req.url).substring(1)] || "application/octet-stream" });
                res.end(data);
            }
        });
    }
    else if (req.url.startsWith("/uploads/")) {
        const uploadedpath = req.url.substring(9);
        if (uploadedpath.includes("..") || uploadedpath.substring(9).includes("/") || uploadedpath.includes("\\") || uploadedpath.length === 0) {
            res.writeHead(403, { "Content-Type": "text/plain" });
            res.end("Forbidden");
            return;
        }
        fs.readFile(ddir + "uploads/" + uploadedpath, function (error, data) {
            if (error) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("File not found");
            }
            else {
                res.writeHead(200, { "Content-Type": mimes[path.extname(req.url).substring(1)] || "application/octet-stream" });
                res.end(data);
            }
        });
    }
    else if (req.url == "/favicon.svg") {
        fs.readFile(fdir + "favicon.svg", function (error, data) {
            if (error) {
                res.writeHead(404, { "Content-Type": "text/html" });
                res.end("File not found");
            }
            else {
                res.writeHead(200, { "Content-Type": "image/svg+xml" });
                res.end(data);
            }
        });
    }
    else {
        fs.readFile(fdir + "index.html", function (error, data) {
            if (error) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Homepage not found");
            }
            else {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(data);
            }
        });
    }
});
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
server.listen(config.port, function (error) {
    if (error) {
        console.log("AUCOFFEE-BACKEND > Something went wrong", error);
    }
    else {
        console.log("AUCOFFEE-BACKEND > Listening on " + config.port);
        api.initDB();
    }
})
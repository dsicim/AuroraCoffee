const path = require('path');
const http = require('http');
const fs = require('fs');
const fetch = require('node-fetch');
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
    "svg": "image/svg+xml",
    "ico": "image/x-icon",
    "json": "application/json",
    "txt": "text/plain"
}
const server = http.createServer(async function (req, res) {
    if (req.url.includes("..")) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
    }
    else if (req.url.startsWith("/api/")) {
        const body = await new Promise((resolve, reject) => {
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
                resolve({ exists: false, json: false, data: null, err: err });
            });
        });
    }
    else if (req.url.startsWith("/assets/")) {
        console.log("Request for asset: " + req.url.substring(8));
        fs.readFile(fdir + "assets/" + req.url.substring(8), function (error, data) {
            if (error) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("File not found");
            }
            else {
                res.writeHead(200, { "Content-Type": mimes[path.extname(req.url.substring(1)).substring(1)] || "application/octet-stream" });
                res.write(data);
                res.end();
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
                res.write(data);
                res.end();
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
                res.write(data);
                res.end();
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
    }
})
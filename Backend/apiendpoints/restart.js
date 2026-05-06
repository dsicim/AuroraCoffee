const { spawn } = require("child_process");
const sql = require("../../Database/server.js");
const fs = require("fs");
const path = require("path");
function streamDump(res, { user, password, host = "localhost", db }) {
    const p = spawn("mysqldump", [
        "-h", host, "-u", user, `-p${password}`,
        "--single-transaction", "--routines", "--triggers", "--events",
        db,
    ]);

    res.setHeader("Content-Type", "application/sql");

    p.stdout.pipe(res);

    let err = "";
    p.stderr.on("data", (c) => (err += c.toString("utf8")));
    p.on("close", (code) => {
        if (code !== 0) console.error("mysqldump failed:", err);
    });
}
function runMysqlAdmin({ host = "localhost", user, password }, sql) {
    return new Promise((resolve, reject) => {
        const p = spawn("mysql", ["-h", host, "-u", user, `-p${password}`, "-e", sql], { stdio: ["ignore", "pipe", "pipe"] });
        let err = "";
        p.stderr.on("data", c => err += c.toString("utf8"));
        p.on("close", code => code === 0 ? resolve() : reject(new Error(err || ("mysql exit " + code))));
    });
}
async function handleAPI(config, method, endpoint, query, body, headers, currentUser, res) {
    if (!currentUser || currentUser.e || currentUser.role !== "Admin") {
        if (headers["authorization"] == config.password) {
            currentUser = { role: "Admin", e: false, username: "internal@youcantdrop.com", displayname: "Internal Communicator", internal: true };
        }
    }
    if (currentUser && !currentUser.e && currentUser.role === "Admin") {
        if (method === "GET") {
            if (endpoint[0] === "getpanel") return { s: 200, j: false, d: fs.readFileSync("./restartpages/innerrestart.html", "utf-8"), h: { "Content-Type": "text/html" } };
            else return { s: 200, j: false, d: fs.readFileSync("./restartpages/restart.html", "utf-8").replaceAll("{inner}", fs.readFileSync("./restartpages/innerrestart.html", "utf-8")), h: { "Content-Type": "text/html" } };
        }
        else if (method === "POST") {
            if (body && body.exists && body.json && !body.err && body.data.action) {
                if (body.data.action === "restart" || body.data.action === "update" || body.data.action === "reset") {
                    if (currentUser.internal) {
                        return { s: 403, j: false, d: "Forbidden" };
                    }
                    return await new Promise((resolve) => {
                        const child = spawn("node", ["updater.js", "--action", body.data.action, "--nologs"], {
                            cwd: path.join(__dirname, ".."),
                            detached: true,
                            stdio: ["ignore", "pipe", "ignore"],
                        });
                        let buffer = "";
                        child.stdout.on("data", chunk => {
                            buffer += chunk.toString("utf8");
                            const newlineIndex = buffer.indexOf("\n");
                            if (newlineIndex !== -1) {
                                const firstLine = buffer.slice(0, newlineIndex).trim();
                                if (firstLine.startsWith("GOTIT:")) {
                                    setTimeout(() => process.exit(0), 2000);
                                }
                                else {
                                    console.error("Unexpected child output:", firstLine);
                                }
                                child.stdout.removeAllListeners("data");
                                child.stdout.destroy();
                                child.unref();
                                if (!firstLine.startsWith("GOTIT:")) resolve({ s: 500, j: false, d: "Failed to initiate server " + body.data.action + ". Child process returned " + firstLine });
                                const actualoutput = firstLine.substring(6);
                                resolve({ s: 200, j: false, d: "Server " + body.data.action + " initiated. Server will be unresponsive for a few " + (body.data.action === "update" ? "minutes" : "seconds") + ".\n" + actualoutput });
                            }
                        });
                    }).catch(err => {
                        resolve({ s: 500, j: false, d: "Failed to initiate server " + body.data.action + ". Child process returned " + err.toString() });
                    });
                }
                else if (body.data.action === "stop") {
                    if (currentUser.internal) {
                        return { s: 403, j: false, d: "Forbidden" };
                    }
                    setTimeout(() => process.exit(0), 2000);
                    return { s: 200, j: false, d: "Server stop initiated. Server will be unresponsive immediately. Only one person can bring the server back up. Goodbye." };
                }
                else if (body.data.action === "dumpsql") {
                    streamDump(res, {
                        user: config.user,
                        password: config.password,
                        host: "localhost",
                        db: config.database
                    });
                    return { s: 200, j: false, d: null, resended: true };
                }
                else if (body.data.action === "sql" || body.data.action === "sqlrerun") {
                    if (currentUser.internal) {
                        return { s: 403, j: false, d: "Forbidden" };
                    }
                    const code = (body.data.action === "sqlrerun" ? fs.readFileSync("../Database/database.sql", "utf-8").replaceAll("USE 308_db;", "").replaceAll("CREATE DATABASE IF NOT EXISTS 308_db;", "") : body.data.code);
                    return await sql.runCode(code).then(res => {
                        if (res.success) {
                            return { s: 200, j: false, d: "Response from SQL:\n" + JSON.stringify(res.result) };
                        }
                        else {
                            return { s: 200, j: false, d: "Unknown Error from SQL:\n" + JSON.stringify(res) }
                        }
                    }).catch(err => {
                        if (err instanceof sql.DBError) return { s: 200, j: false, d: "Error from SQL:\n" + err.error };
                        else return { s: 200, j: false, d: "An unknown error occurred" + err.toString() };
                    });
                }
                else if (body.data.action === "restore") {
                    const backup = config.isBackup;
                    const sqlDumpFromOtherSite = await fetch((backup ? "https://auroracoffee.youcantdrop.com" : "https://backupauroracoffee.youcantdrop.com") + "/api/restart", { headers: { authorization: config.password }, method: "POST", body: JSON.stringify({ action: "dumpsql" }) });
                    if (!sqlDumpFromOtherSite.ok) {
                        return { s: 500, j: false, d: "Failed to fetch SQL dump from " + (backup ? "main site" : "backup site") + ": " + sqlDumpFromOtherSite.statusText };
                    }
                    await runMysqlAdmin(
                        { user: DB_USER, password: DB_PASS },
                        "DROP DATABASE IF EXISTS 308_db; CREATE DATABASE 308_db;"
                    );
                    const mysql = spawn("mysql", ["-h", "localhost", "-u", config.user, `-p ${config.password}`, "308_db"], {
                        stdio: ["pipe", "ignore", "pipe"],
                    });

                    let mysqlErr = "";
                    mysql.stderr.on("data", (c) => (mysqlErr += c.toString("utf8")));

                    await new Promise((resolve, reject) => {
                        dumpRes.body.pipe(mysql.stdin);
                        dumpRes.body.on("error", reject);
                        mysql.on("error", reject);
                        mysql.on("close", (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(mysqlErr || `mysql exited ${code}`));
                        });
                    });


                    return await sql.getAllImageURLs().then(async result => {
                        if (result.success) {
                            const baseURL = backup ? "https://auroracoffee.youcantdrop.com/uploads/" : "https://backupauroracoffee.youcantdrop.com/uploads/";
                            result.image_urls.forEach(async (url) => {
                                await fetch(baseURL +url).then(res => {
                                    if (!res.ok) {
                                        throw new Error("Failed to fetch image URL " + url + ": " + res.statusText);
                                    }
                                    else {
                                        const writeStream = fs.createWriteStream(path.join(__dirname, "..", "Database", "uploads", path.basename(url)));
                                        res.body.pipe(writeStream);
                                    }
                                }).catch(err => console.error("Failed to fetch image URL " + url + ": " + err.toString()));
                            });
                            return { s: 200, j: true, d: "Database restore successful from " + (backup ? "main site" : "backup site") };
                        }
                        else {
                            return { s: 400, j: true, d: { e: "An unknown error occurred" } };
                        }
                    }).catch(err => {
                        console.error("Get all image URLs error:", err);
                        if (err instanceof sql.DBError) return { s: err.status, j: true, d: { e: err.error || "An unknown error occurred" } };
                        else return { s: 500, j: true, d: { e: "An unknown error occurred" } };
                    });
                }
                else if (body.data.action === "backup") {
                    const backup = config.isBackup;
                    const restoreSqlFromThisSite = await fetch((backup ? "https://auroracoffee.youcantdrop.com" : "https://backupauroracoffee.youcantdrop.com") + "/api/restart", { headers: { authorization: config.password }, method: "POST", body: JSON.stringify({ action: "restore" }) });
                    if (!restoreSqlFromThisSite.ok) {
                        return { s: 500, j: false, d: "Failed to send SQL dump to " + (backup ? "main site" : "backup site") + ": " + restoreSqlFromThisSite.statusText };
                    }
                    return { s: 200, j: false, d: "Database backup successful to " + (backup ? "main site" : "backup site") };
                }
                else if (body.data.action === "resetdb") {
                    if (currentUser.internal) {
                        return { s: 403, j: false, d: "Forbidden" };
                    }
                    return { s: 500, j: false, d: "Not implemented yet" };
                }
                else return { s: 400, j: false, d: "Invalid action" };
            }
            else return { s: 400, j: false, d: "Invalid request body" };
        }
        else return { s: 405, j: false, d: "Method Not Allowed" };
    }
    else return { s: 200, j: false, d: fs.readFileSync("./restartpages/restart.html", "utf-8"), h: { "Content-Type": "text/html" } };
}
module.exports = { handleAPI };
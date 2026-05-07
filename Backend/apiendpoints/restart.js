const { spawn } = require("child_process");
const sql = require("../../Database/server.js");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { Readable } = require("stream");
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
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.setHeader("Cache-Control", "no-cache");
                    res.setHeader("X-Accel-Buffering", "no");
                    res.flushHeaders();
                    res.write("FULL DATABASE RESTORE INITIATED FROM " + (backup ? "MAIN SITE" : "BACKUP SITE") + "\n");
                    const sqlDumpFromOtherSite = await fetch((backup ? "https://auroracoffee.youcantdrop.com" : "https://backupauroracoffee.youcantdrop.com") + "/api/restart", { headers: { authorization: config.password }, method: "POST", body: JSON.stringify({ action: "dumpsql" }) });
                    if (!sqlDumpFromOtherSite.ok) {
                        res.write("Failed to fetch SQL dump from " + (backup ? "main site" : "backup site") + ": " + sqlDumpFromOtherSite.statusText);
                        res.end();
                        return { s: 500, j: false, d: null, resended: true };
                    }
                    res.write((backup ? "MAIN SITE" : "BACKUP SITE") + " CONTACTED FOR SQL DUMP, STARTING TO STREAM AND RESTORE DATABASE\n");
                    await runMysqlAdmin(
                        { user: config.user, password: config.password },
                        ["USE 308_db",
                        "SET FOREIGN_KEY_CHECKS=0",
                        "SET @v := (SELECT GROUP_CONCAT(CONCAT('`', table_name, '`') SEPARATOR ',') FROM information_schema.views WHERE table_schema='308_db')",
                        "SET @sv := IF(@v IS NULL, 'SELECT 1', CONCAT('DROP VIEW ', @v))",
                        "PREPARE stmtv FROM @sv",
                        "EXECUTE stmtv",
                        "DEALLOCATE PREPARE stmtv",

                        // drop base tables
                        "SET @t := (SELECT GROUP_CONCAT(CONCAT('`', table_name, '`') SEPARATOR ',') FROM information_schema.tables WHERE table_schema='308_db' AND table_type='BASE TABLE')",
                        "SET @st := IF(@t IS NULL, 'SELECT 1', CONCAT('DROP TABLE ', @t))",
                        "PREPARE stmtt FROM @st",
                        "EXECUTE stmtt",
                        "DEALLOCATE PREPARE stmtt",

                        // drop routines
                        "SET @p := (SELECT GROUP_CONCAT(CONCAT('`', routine_name, '`') SEPARATOR ',') FROM information_schema.routines WHERE routine_schema='308_db' AND routine_type='PROCEDURE')",
                        "SET @sp := IF(@p IS NULL, 'SELECT 1', CONCAT('DROP PROCEDURE ', @p))",
                        "PREPARE stmtp FROM @sp",
                        "EXECUTE stmtp",
                        "DEALLOCATE PREPARE stmtp",

                        "SET @f := (SELECT GROUP_CONCAT(CONCAT('`', routine_name, '`') SEPARATOR ',') FROM information_schema.routines WHERE routine_schema='308_db' AND routine_type='FUNCTION')",
                        "SET @sf := IF(@f IS NULL, 'SELECT 1', CONCAT('DROP FUNCTION ', @f))",
                        "PREPARE stmtf FROM @sf",
                        "EXECUTE stmtf",
                        "DEALLOCATE PREPARE stmtf",

                        // drop events
                        "SET @e := (SELECT GROUP_CONCAT(CONCAT('`', event_name, '`') SEPARATOR ',') FROM information_schema.events WHERE event_schema='308_db')",
                        "SET @se := IF(@e IS NULL, 'SELECT 1', CONCAT('DROP EVENT ', @e))",
                        "PREPARE stmte FROM @se",
                        "EXECUTE stmte",
                        "DEALLOCATE PREPARE stmte",

                        "SET FOREIGN_KEY_CHECKS=1"].join("; ")
                    );
                    res.write((backup ? "MAIN SITE" : "BACKUP SITE") + " DATABASE DROPPED.\n");
                    const mysql = spawn("mysql", ["-h", "localhost", "-u", config.user, `-p${config.password}`, "308_db"], {
                        stdio: ["pipe", "ignore", "pipe"],
                    });
                    res.write((backup ? "MAIN SITE" : "BACKUP SITE") + " IMAGES DROPPED.\n");
                    await fsp.rm(path.join(__dirname, "..", "Database", "uploads"), { recursive: true, force: true });
                    await fsp.mkdir(path.join(__dirname, "..", "Database", "uploads"), { recursive: true });

                    let mysqlErr = "";
                    mysql.stderr.on("data", (c) => (mysqlErr += c.toString("utf8")));

                    res.write("REBUILDING SQL FROM DUMP...\n");
                    await new Promise((resolve, reject) => {
                        const dumpStream = Readable.fromWeb(sqlDumpFromOtherSite.body);
                        dumpStream.on("error", reject);
                        dumpStream.pipe(mysql.stdin);
                        mysql.on("error", reject);
                        mysql.on("close", (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(mysqlErr || `mysql exited ${code}`));
                        });
                    });


                    res.write("REDOWNLOADING IMAGES...\n");
                    return await sql.getAllImageURLs().then(async result => {
                        if (result.success) {
                            res.write("FOUND IMAGES TO DOWNLOAD.\n");
                            const baseURL = backup ? "https://auroracoffee.youcantdrop.com/uploads/" : "https://backupauroracoffee.youcantdrop.com/uploads/";
                            for (const [i, url] of result.image_urls.entries()) {
                                try {
                                    res.write(`Fetching image ${i + 1}/${result.image_urls.length}\n`);
                                    const resp = await fetch(baseURL + url);
                                    if (!resp.ok) throw new Error(`Fetch failed ${resp.status} ${resp.statusText}`);
                                    const dest = path.join(__dirname, "..", "Database", "uploads", path.basename(url));

                                    await new Promise((resolve, reject) => {
                                    const writeStream = fs.createWriteStream(dest);
                                    const bodyStream = Readable.fromWeb(resp.body);

                                    bodyStream.on("error", (err) => {
                                        writeStream.destroy();
                                        reject(err);
                                    });
                                    writeStream.on("error", (err) => {
                                        bodyStream.destroy();
                                        reject(err);
                                    });
                                    writeStream.on("finish", resolve);

                                    bodyStream.pipe(writeStream);
                                    });

                                    res.write(`Downloaded ${url}\n`);
                                } catch (err) {
                                    console.error("Failed to fetch image URL " + baseURL + url + ": " + err.toString());
                                }
                            }
                            res.write("RESTORE COMPLETE.\n");
                            res.write("Database restore successful from " + (backup ? "main site" : "backup site") + "\n");
                            res.end();
                            return { s: 200, j: false, d: null, resended: true };
                        }
                        else {
                            res.write("An unknown error occurred\n");
                            res.end();
                            return { s: 500, j: false, d: null, resended: true };
                        }
                    }).catch(err => {
                        console.error("Get all image URLs error:", err);
                        if (err instanceof sql.DBError) res.write((err.error+"\n") || "An unknown error occurred\n");
                        else res.write("An unknown error occurred\n");
                        res.end();
                        return { s: 500, j: false, d: null, resended: true };
                    });
                }
                else if (body.data.action === "backup") {
                    const backup = config.isBackup;


                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    res.setHeader("Cache-Control", "no-cache");
                    res.setHeader("X-Accel-Buffering", "no");

                    const upstream = await fetch((backup ? "https://auroracoffee.youcantdrop.com" : "https://backupauroracoffee.youcantdrop.com") + "/api/restart",
                        {
                            headers: { authorization: config.password, "content-type": "application/json" },
                            method: "POST",
                            body: JSON.stringify({ action: "restore" }),
                        }
                    );

                    res.statusCode = upstream.status;
                    res.flushHeaders();

                    if (!upstream.body) {
                        res.end("No response body from upstream restore.");
                        return { s: upstream.status, j: false, d: null, resended: true };
                    }
                    
                    const upstreamStream = Readable.fromWeb(upstream.body);
                    upstreamStream.pipe(res, { end: false });

                    upstreamStream.on("end", () => {
                        res.write("Database backup successful to " + (backup ? "main site" : "backup site") + "\n");
                        res.end();
                    });

                    upstreamStream.on("error", (err) => {
                        res.write("ERROR: " + err.toString() + "\n");
                        res.end();
                    });
                    return { s: 200, j: false, d: null, resended: true };
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
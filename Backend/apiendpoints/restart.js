const { spawn } = require("child_process");
const sql = require("../../Database/server.js");
const fs = require("fs");
const path = require("path");
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (query && Object.keys(query).length && query.key && query.key === config.restarttoken) {
        if (method === "GET") {
            return { s: 200, j: false, d: fs.readFileSync("./restart.html", "utf-8"), h: { "Content-Type": "text/html" } };
        }
        else if (method === "POST") {
            if (body && body.exists && body.json && !body.err && body.data.action) {
                if (body.data.action === "restart" || body.data.action === "update") {
                    return await new Promise((resolve) => {
                        const child = spawn("node", ["version.js", "--action", body.data.action], {
                            cwd: path.join(__dirname, "../"),
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
                    setTimeout(() => process.exit(0), 2000);
                    return { s: 200, j: false, d: "Server stop initiated. Server will be unresponsive immediately. Only one person can bring the server back up. Goodbye." };
                }
                else if (body.data.action === "sql" || body.data.action === "sqlrerun") {
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
                else if (body.data.action === "reset") {
                    return { s: 500, j: false, d: "Not implemented yet" };
                }
                else return { s: 400, j: false, d: "Invalid action" };
            }
            else return { s: 400, j: false, d: "Invalid request body" };
        }
        else return { s: 405, j: false, d: "Method Not Allowed" };
    }
    else return { s: 401, j: true, d: { e: "Unauthorized" } };
}
module.exports = { handleAPI };
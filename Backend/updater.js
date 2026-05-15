const fetch = require("node-fetch");
const { spawn, exec } = require("child_process");
const path = require("path");
const http = require('http');
const fs = require("fs");
const fsp = require("fs").promises;
async function getUpToDateVersion() {
    const github = await fetch("https://api.github.com/repos/dsicim/AuroraCoffee/commits?per_page=1&sha=main").then(res => res.headers.get("link")).catch(err => null);
    if (!github) {
        return { s: false };
    }
    let latestCommit = null;
    try {
        latestCommit = github.split(",").find(s => s.includes('rel="last"')).match(/&page=(\d+)>/)[1];
    }
    catch (err) {
        return { s: false };
    }
    let sprintNo = null;
    try {
        sprintNo = fs.readFileSync("./scrumnumber.txt", "utf-8").trim().split(".").map(s => parseInt(s.trim()));
    }
    catch (err) {
        return { s: false };
    }
    if (!latestCommit || !sprintNo) {
        return { s: false };
    }
    const latestVersion = "0." + sprintNo[0] + "." + (latestCommit - sprintNo[1]);
    return { s: true, v: latestVersion };
}
function execute(command, options = {}, logfile = null) {
    logtext("RUN: " + command);
    return new Promise((resolve, reject) => {
        const child = exec(command, options, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve({ stdout, stderr });
        });
        let logStream = null;
        if (logfile && log) {
            logStream = fs.createWriteStream(logfile, { flags: "a" });
        }

        if (child.stdout) {
            if (log && logconsole) child.stdout.pipe(process.stdout);
            if (logStream) child.stdout.pipe(logStream, { end: false });
        }
        if (child.stderr) {
            if (log && logconsole) child.stderr.pipe(process.stderr);
            if (logStream) child.stderr.pipe(logStream, { end: false });
        }

        child.on("close", () => {
            if (logStream) logStream.end();
        });
        child.on("error", err => {
            if (logStream) logStream.end();
            reject(err);
        });
    });
}
const log = true;
let logconsole = true;
function logtext(text) {
    if (log) {
        fs.appendFileSync("./resetlog.log", text + "\n");
        if (logconsole) console.log(text);
    }
}
const stateClients = new Set();

function writeToClient(res, msg) {
  return new Promise((resolve) => {
    const wrote = res.write(msg + "\n", "utf8", () => resolve());
    if (!wrote && res.socket) res.socket.once("drain", resolve);
  });
}
let currentstate = "Starting...";
let stateupdated = false;
let statecleared = false;
async function updatestate(newstate, timeoutMs = 5000) {
  currentstate = newstate;
  logtext("STATE: " + newstate);  
  if (stateClients.size === 0) return;
  const writes = Array.from(stateClients).map(res =>
    writeToClient(res, currentstate).catch(() => stateClients.delete(res))
  );
  await Promise.race([Promise.all(writes), new Promise(r => setTimeout(r, timeoutMs))]);
}

async function clearstate(timeoutMs = 3000) {
  for (const res of Array.from(stateClients)) {
    try { res.end(); } catch (e) {}
    stateClients.delete(res);
  }
  await new Promise(r => setTimeout(r, Math.min(200, timeoutMs)));
}
async function runResetScript(repoParent,gitrepo) {
    try {
        const cwd = repoParent;
        if (log) fs.writeFileSync("./resetlog.log", "");
        await updatestate("Removing built folder...");
        try {
            await fsp.rm(path.join(cwd, "AuroraCoffee"), { recursive: true, force: true });
            logtext("Removed directory");
        } catch (err) {
            logtext("Failed to remove directory: "+err);
            throw err;
        }
        logtext("Removed directory.");
        await updatestate("Cloning repository...");
        await execute("git clone -b main "+gitrepo, { cwd: cwd }, "./resetlog.log");
        logtext("Cloned repository.");
        await updatestate("Applying configuration...");
        await fs.copyFile("./config.json", path.join(cwd, "AuroraCoffee/Backend/config.json"), err => { });
        await fs.rm(path.join(cwd, "AuroraCoffee/Backend/config.json.example"), { force: true }, err => { });
        logtext("Updated config.json.");
        await updatestate("Installing backend dependencies...");
        await execute("npm i", { cwd: cwd + "/AuroraCoffee/Backend" }, "./resetlog.log");
        await updatestate("Auditing backend dependencies...");
        await execute("npm audit fix", { cwd: cwd + "/AuroraCoffee/Backend" }, "./resetlog.log");
        logtext("Updated backend dependencies.");
        await updatestate("Installing frontend dependencies...");
        await execute("npm i", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        await updatestate("Auditing frontend dependencies...");
        await execute("npm audit fix", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        logtext("Updated frontend dependencies.");
        await updatestate("Building frontend...");
        await execute("npm run build", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        await updatestate("Linting ECMAScript...");
        await execute("npm run lint", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        logtext("Built frontend.");
        await updatestate("Installing database dependencies...");
        await execute("npm i", { cwd: cwd + "/AuroraCoffee/Database" }, "./resetlog.log");
        await updatestate("Auditing database dependencies...");
        await execute("npm audit fix", { cwd: cwd + "/AuroraCoffee/Database" }, "./resetlog.log");
        logtext("Updated database dependencies.");
        return "Success: reset completed successfully";
    }
    catch (err) {
        logtext("Error during reset: " + err + "");
        return "Error: " + err;
    }
}
async function runUpdateScript(repoParent) {
    try {
        const cwd = repoParent;
        if (log) fs.writeFileSync("./resetlog.log", "");
        await updatestate("Fetching latest changes...");
        await execute("git switch main", { cwd: path.join(cwd, "/AuroraCoffee") }, "./resetlog.log");
        await execute("git fetch origin", { cwd: path.join(cwd, "/AuroraCoffee") }, "./resetlog.log");
        const { stdout } = await execute("git diff --name-only HEAD..origin/main -- Frontend/",{ cwd: cwd + "/AuroraCoffee" },"./resetlog.log");
        const frontendChanges = stdout.trim().split("\n").map(s => s.substring(9)).map(s => s.trim()).filter(s => s.length > 0);
        const frontendUpdated = frontendChanges.length > 0;
        if (frontendUpdated) logtext("Frontend changes detected: \n" + frontendChanges.join("\n"));
        else logtext("No frontend changes detected. Skipping frontend build.");
        await updatestate("Applying latest changes...");
        await execute("git reset --hard origin/main", { cwd: path.join(cwd, "/AuroraCoffee") }, "./resetlog.log");
        logtext("Updated git repo.");
        await updatestate("Applying configuration...");
        await fs.copyFile("./config.json", path.join(cwd, "/AuroraCoffee/Backend/config.json"), err => { });
        await fs.rm(path.join(cwd, "/AuroraCoffee/Backend/config.json.example"), { force: true }, err => { });
        logtext("Copied config file.");
        if (frontendUpdated) {
            await updatestate("Removing frontend build...");
            await fs.rm(path.join(cwd, "/AuroraCoffee/Frontend/dist"), { force: true }, err => { });
            await updatestate("Building frontend...");
            await execute("npm run build", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
            await updatestate("Linting ECMAScript...");
            await execute("npm run lint", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
            logtext("Built frontend.");
        }
        logtext("Update completed.");
        return "Success: update completed successfully";
    }
    catch (err) {
        logtext("Error during update: " + err + "");
        return "Error: " + err;
    }
}
async function waitForPortAvailable(port, maxAttempts = 20, delayMs = 500) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        logtext(`Checking if port ${port} is available (attempt ${attempt + 1}/${maxAttempts})...`);
        try {
            await new Promise((resolve, reject) => {
                const testServer = http.createServer();
                testServer.listen(port, () => {
                    logtext(`got port ${port}...`);
                    testServer.close(() => resolve());
                });
                testServer.on("error", reject);
            });
            return true;
        } catch (err) {
            logtext(`Port ${port} is not available yet.`);
            if (attempt < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
    }
    return false;
}
async function RunServerMaintenance() {
    const args = process.argv.slice(2);
    const index = args.indexOf("--action");
    if (index === -1 || index === args.length - 1) {
        console.log("NOWAIT: No action specified, skipping maintenance");
        return null;
    }
    const logs = args.indexOf("--nologs") !== -1;
    const norestart = args.indexOf("--norestart") !== -1;
    if (logs) logconsole = false;
    const action = args[index + 1];
    if (action === "restart" || action === "update" || action === "reset") {
        let updateneeded = false;
        const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        const current = config.version ? { s: true, v: config.version } : { s: false };
        const latest = (action === "update" || action === "reset") ? await getUpToDateVersion() : { s: true, v: current.v };
        if (action === "update" || action === "reset") updateneeded = true;
        if (updateneeded && latest.s && current.s && latest.v == current.v) updateneeded = false;
        if (updateneeded) console.log("GOTIT:Updating from version " + (current.s ? current.v : "unknown") + " to " + (latest.s ? latest.v : "unknown"));
        else if (action === "update") console.log("GOTIT: No update needed, current version " + (current.s ? current.v : "unknown") + " is up to date. Restarting without updating.");
        else if (action === "reset") console.log("GOTIT: Force reinstall requested. Restarting with updated files. This will take a while.");
        else console.log("GOTIT:Restarting without update");
        

        const portAvailable = await waitForPortAvailable(config.port, 40, 500);
        logtext(portAvailable ? "Port is available, proceeding with maintenance." : "Port is still not available after waiting. Stopping under assumption that server has NOT stopped.");
        if (!portAvailable) {
            logtext("Port " + config.port + " is not available after several attempts. Main server may still be running or failed to stop. Please check the server status and restart manually if needed.");
            return;
        }
        console.log("Under assumption that server has stopped.");
        let fdir = path.join(__dirname, "restartpages","updatingpage.html");
        const server = http.createServer(async function (req, res) {
            if (req.headers["x-connection"]) {
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("X-Accel-Buffering", "no");
                res.flushHeaders();
                stateClients.add(res);
                try { res.write(currentstate+ "\n"); } catch (e) { stateClients.delete(res); }
                if (statecleared) {
                    res.end();
                    stateClients.delete(res);
                    return;
                }
                req.on("close", () => stateClients.delete(res));
                return;
            }
            else {
                fs.readFile(fdir, "utf-8", (err, data) => {
                    if (err) {
                        res.writeHead(500, { "Content-Type": "text/plain" });
                        res.end("Updater: Internal Server Error");
                    }
                    else {
                        res.writeHead(200, { "Content-Type": "text/html" });
                        data = data.replace("{{{updating-title}}}", action === "reset" ? "Rebuilding": (updateneeded ? "Updating" : "Restarting"));
                        res.end(data);
                    }
                });
            }
        });
        logtext("Starting updater server...");
        server.listen(config.port, function (error) {
            if (error) {
                logtext("AUCOFFEE-UPDATER > Something went wrong", error);
            }
            else {
                logtext("AUCOFFEE-UPDATER > Listening on " + config.port);
            }
        });
        logtext("Changing working directory to repo parent...");
        if (action === "reset") {
            await fsp.copyFile(path.join(__dirname, "./restartpages/updatingpage.html"), path.join(__dirname, "../../updatingpage.html"));
            fdir = path.join(__dirname, "../../updatingpage.html");
        }
        const repoParent = path.join(__dirname, "../..");
        process.chdir(repoParent);
        if (updateneeded || action === "reset") {
            console.log("Running git refresh script...");
            await updatestate("Starting update...");
            const output = (action === "reset") ? await runResetScript(repoParent,config.gitrepo).then(res => res).catch(err => "Error: " + err) : await runUpdateScript(repoParent).then(res => res).catch(err => "Error: " + err);
            console.log(output);
            if (output.startsWith("Success:")) {
                await updatestate("Finishing up...");
                const cfg = JSON.parse(fs.readFileSync("./AuroraCoffee/Backend/config.json", "utf-8"));
                cfg.version = latest.v;
                fs.writeFileSync("./AuroraCoffee/Backend/config.json", JSON.stringify(cfg, null, 4), "utf-8");
                console.log("Updated version in config.json to " + latest.v);
                if (action === "reset") await updatestate("Rebuild completed. Refreshing page...");
                else await updatestate("Update completed. Refreshing page...");
            }
        }
        else {
            if (norestart) await updatestate("Restart skipped due to --norestart flag. Please restart the server manually and refresh the page.");
            else await updatestate("Restart completed. Refreshing page...");
        }
        await new Promise((resolve) => {
            setTimeout(() => {
                clearstate();
                resolve();
            }, 1000);
        });
        await new Promise((resolve) => {
            setTimeout(() => {
                server.close(() => {
                    resolve();
                });
            }, 1000);
        });
        await new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, 2000);
        });
        const backendDir = path.join(repoParent, "AuroraCoffee/Backend");
        if (!norestart) {
            console.log("Restarting server...");
            spawn("node", ["."], {
                cwd: backendDir,
                detached: true,
                stdio: "ignore",
            }).unref();
        }
        else {
            console.log("Changes applied. Restart skipped due to --norestart flag. Please restart the server manually.");
        }
    }
    else console.log("NOWAIT: Invalid action given");
}
if (require.main === module) {
    RunServerMaintenance();
}
module.exports = { getUpToDateVersion };
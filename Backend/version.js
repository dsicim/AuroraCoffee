const fetch = require("node-fetch");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
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
            if (logStream) child.stdout.pipe(logStream, { end: false });
        }
        if (child.stderr) {
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
async function runResetScript(repoParent) {
    try {
        const cwd = repoParent;
        if (log) fs.writeFileSync("./resetlog.log", "");
        try {
            await fs.promises.rm(path.join(cwd, "AuroraCoffee"), { recursive: true, force: true });
            if (log) fs.appendFileSync("./resetlog.log", "Removed directory\n");
        } catch (err) {
            if (log) fs.appendFileSync("./resetlog.log", "Failed to remove directory: "+err+"\n");
            throw err;
        }
        await fs.rm(path.join(cwd, "AuroraCoffee"), { recursive: true, forced: true }, err => { });
        if (log) fs.appendFileSync("./resetlog.log", "Removed directory.\n");
        await execute("git clone -b main "+config.gitrepo, { cwd: cwd }, "./resetlog.log");
        if (log) fs.appendFileSync("./resetlog.log", "Cloned repository.\n");
        await fs.copyFile("./config.json", path.join(cwd, "AuroraCoffee/Backend/config.json"), err => { });
        await fs.rm(path.join(cwd, "AuroraCoffee/Backend/config.json.example"), { force: true }, err => { });
        if (log) fs.appendFileSync("./resetlog.log", "Updated config.json.\n");
        await execute("npm i", { cwd: cwd + "/AuroraCoffee/Backend" }, "./resetlog.log");
        await execute("npm audit fix", { cwd: cwd + "/AuroraCoffee/Backend" }, "./resetlog.log");
        if (log) fs.appendFileSync("./resetlog.log", "Updated backend dependencies.\n");
        await execute("npm i", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        await execute("npm audit fix", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        if (log) fs.appendFileSync("./resetlog.log", "Updated frontend dependencies.\n");
        await execute("npm run build", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        await execute("npm run lint", { cwd: cwd + "/AuroraCoffee/Frontend" }, "./resetlog.log");
        if (log) fs.appendFileSync("./resetlog.log", "Built frontend.\n");
        await execute("npm i", { cwd: cwd + "/AuroraCoffee/Database" }, "./resetlog.log");
        await execute("npm audit fix", { cwd: cwd + "/AuroraCoffee/Database" }, "./resetlog.log");
        if (log) fs.appendFileSync("./resetlog.log", "Updated database dependencies.\n");
        return "Success: reset.sh completed successfully";
    }
    catch (err) {
        if (log) fs.appendFileSync("./resetlog.log", "Error during reset: " + err + "\n");
        return "Error: " + err;
    }
}
async function RunServerMaintenance() {
    const args = process.argv.slice(2);
    const index = args.indexOf("--action");
    if (index === -1 || index === args.length - 1) {
        console.log("NOWAIT: No action specified, skipping maintenance");
        return null;
    }
    const action = args[index + 1];
    if (action === "restart" || action === "update") {
        let updateneeded = false;
        const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        const current = config.version ? { s: true, v: config.version } : { s: false };
        const latest = action === "update" ? await getUpToDateVersion() : { s: true, v: current.v };
        if (action === "update") updateneeded = true;
        if (updateneeded && latest.s && current.s && latest.v == current.v) updateneeded = false;
        if (updateneeded) console.log("GOTIT:Updating from version " + (current.s ? current.v : "unknown") + " to " + (latest.s ? latest.v : "unknown"));
        else if (action === "update") console.log("GOTIT: No update needed, current version " + (current.s ? current.v : "unknown") + " is up to date. Restarting without updating.");
        else console.log("GOTIT:Restarting without update");
        setTimeout(async () => {
            console.log("Under assumption that server has stopped.");
            const repoParent = path.join(__dirname, "../..");
            process.chdir(repoParent);
            if (updateneeded) {
                console.log("Running git refresh script...");
                const output = await runResetScript(repoParent).then(res => res).catch(err => "Error: " + err);
                console.log(output);
                if (output.startsWith("Success:")) {
                    config.version = latest.v;
                    fs.writeFileSync("./AuroraCoffee/Backend/config.json", JSON.stringify(config, null, 4), "utf-8");
                    console.log("Updated version in config.json to " + latest.v);
                }
            }
            console.log("Starting server...");
            const backendDir = path.join(repoParent, "AuroraCoffee/Backend");
            spawn("node", ["."], {
                cwd: backendDir,
                detached: true,
                stdio: "ignore",
            }).unref();
        }, 3000);
    }
    else console.log("NOWAIT: Invalid action given");
}
if (require.main === module) {
    RunServerMaintenance();
}
module.exports = { getUpToDateVersion };
const fetch = require("node-fetch");
const { spawn } = require("child_process");
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
async function runResetScript() {
    const cwd = path.join(__dirname, "../..");
    fs.writeFileSync("./resetlog.log", "");
    return new Promise((resolve, reject) => {
        const child = spawn("sh", ["reset.sh"], {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });
        child.stdout.on("data", chunk => {
            fs.appendFileSync("./resetlog.log", chunk);
            process.stdout.write(chunk);
        });
        child.stderr.on("data", chunk => {
            fs.appendFileSync("./resetlog.log", chunk);
            process.stderr.write(chunk);
        });
        child.on("close", code => {
            console.log(`reset.sh exited with code ${code}`);
            if (code === 0) {
                console.log("reset.sh completed successfully");
                resolve("Success: reset.sh completed successfully");
            }
            else {
                console.error("reset.sh failed with exit code " + code);
                reject("Error: reset.sh failed with exit code " + code);
            }
        });
        child.on("error", err => {
            console.error("Failed to start reset.sh:", err);
            reject("Error: Failed to start reset.sh: " + err);
        });
    });
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
                const output = await runResetScript().then(res => res).catch(err => "Error: " + err);
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
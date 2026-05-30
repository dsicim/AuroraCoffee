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
async function handleAPI(config, method, endpoint, query, body, headers, currentUser) {
    if (endpoint[0] === "latest") {
        const uptodate = await getUpToDateVersion().then(res => res.s ? res.v : null).catch(err => null);
        return { s: 200, j: false, d: uptodate || "Error: Failed to fetch latest version", h: { "Access-Control-Allow-Origin": "*" } };
    }
    return { s: 200, j: false, d: config.version, h: { "Access-Control-Allow-Origin": "*" } };
}
module.exports = { handleAPI };
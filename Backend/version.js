const fetch = require("node-fetch");
const fs = require("fs");
async function getUpToDateVersion() {
    const github = await fetch("https://api.github.com/repos/dsicim/AuroraCoffee/commits?per_page=1&sha=main").then(res => res.headers.get("link")).catch(err => null);
    console.log(github);
    if (!github) {
        return {s:false};
    }
    let latestCommit = null;
    try {
        latestCommit = github.split(",").find(s => s.includes('rel="last"')).match(/&page=(\d+)>/)[1];
    }
    catch (err) {
        return {s:false};
    }
    let sprintNo = null;
    try {
        sprintNo = fs.readFileSync("./scrumnumber.txt", "utf-8").trim().split(".").map(s => parseInt(s.trim()));
    }
    catch (err) {
        return {s:false};
    }
    if (!latestCommit || !sprintNo) {
        return {s:false};
    }
    const latestVersion = "0." + sprintNo[0] + "." + (latestCommit - sprintNo[1]);
    return {s:true, v:latestVersion};
}
module.exports = { getUpToDateVersion };
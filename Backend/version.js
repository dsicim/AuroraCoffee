const fetch = require("node-fetch");
async function getUpToDateVersion() {
    const github = await fetch("https://api.github.com/repos/dsicim/AuroraCoffee/commits?per_page=1&sha=main").then(res => res.headers.get("link")).catch(err => null);
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
    const sprint = await fetch("https://raw.githubusercontent.com/dsicim/AuroraCoffee/refs/heads/main/Backend/scrumnumber.txt").then(res => res.text()).catch(err => null);
    let sprintNo = null;
    try {
        sprintNo = (sprint == "404: Not Found") ? null : sprint.split(".").map(s => parseInt(s.trim()));
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
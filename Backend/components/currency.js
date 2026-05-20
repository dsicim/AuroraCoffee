const currencies = new Map();
let lastUpdate = 0;
const supportedCurrencies = ["TRY", "USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
currencies.set("TRY", 1);
async function SetCurrencies() {
    await fetch("https://api.frankfurter.dev/v2/rates?base=TRY").then(res => res.json()).then(data => {
        try {
            if (Array.isArray(data)) {
                data.forEach(item => {
                    currencies.set(item.quote, item.rate);
                });
                lastUpdate = new Date().getTime();
                console.log("Currency rates updated:");
            }
            else {
                console.error("Unexpected currency data format:", data);
            }
        }
        catch (err) {
            console.error("Error processing currency data:", err);
        }
    }).catch(err => {
        console.error("Failed to fetch currency rates:", err);
    });
}
SetCurrencies();
setInterval(SetCurrencies, 60 * 60 * 1000);
function GetCurrencies() {
    const obj = {
        currencies: {},
        lastUpdated: lastUpdate
    }
    currencies.forEach((value, key) => { obj.currencies[key] = value; });
    return obj;
}
module.exports = { GetCurrencies };
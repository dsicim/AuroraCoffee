const currencies = new Map();
let lastUpdate = 0;
const supportedCurrencies = ['TRY','CHF','EUR','GBP','IRR','NOK','RUB','SEK','USD'];
currencies.set("TRY", 1);
async function SetCurrencies() {
    try {
    const res = await fetch('https://api.frankfurter.dev/v2/rates?base=TRY&quotes=' + supportedCurrencies.join(","));
    const data = await res.json();
    if (Array.isArray(data)) {
      const map = {};
      data.forEach(item => { if (item && item.quote && supportedCurrencies.includes(item.quote)) currencies.set(item.quote, item.rate); });
    } else {
      console.error('Unexpected currency response format:', data);
      return;
    }
    lastUpdate = Date.now();
    console.log('Currency rates updated', new Date(lastUpdate).toISOString());
  } catch (err) {
    console.error('Failed to fetch currency rates:', err && err.name === 'AbortError' ? 'timeout' : err);
  }
}
SetCurrencies();
setInterval(SetCurrencies, 60 * 60 * 1000);
function GetCurrencies() {
    const obj = {
        currencies: {},
        max: {},
        lastUpdated: lastUpdate
    }
    currencies.forEach((value, key) => {
        obj.currencies[key] = value;
        const max = key == "IRR" ? 500000000: 100000;
        obj.max[key] = max / value;
    });
    return obj;
}
module.exports = { GetCurrencies };
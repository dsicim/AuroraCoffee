const currencies = new Map();
let lastUpdate = 0;
const supportedCurrencies = [];
currencies.set("TRY", 1);
async function SetCurrencies() {
    try {
    const res = await fetch('https://api.frankfurter.dev/v2/rates?base=TRY');
    const data = await res.json();
    const supported = ['TRY', 'CHF','EUR', 'GBP','IRR', 'NOK','RUB', 'SEK','USD'];
    if (Array.isArray(data)) {
      const map = {};
      data.forEach(item => { if (item && item.quote && supported.includes(item.quote)) currencies.set(item.quote, item.rate); });
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
        lastUpdated: lastUpdate
    }
    currencies.forEach((value, key) => { obj.currencies[key] = value; });
    return obj;
}
module.exports = { GetCurrencies };
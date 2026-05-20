const currencies = new Map();
let lastUpdate = 0;
const supportedCurrencies = [];
currencies.set("TRY", 1);
async function SetCurrencies() {
    try {
    const res = await fetch('https://api.frankfurter.dev/v2/rates?base=TRY');
    const data = await res.json();
    // frankfurter may return an array of {date, base, quote, rate} or an object {rates: {...}}
    if (Array.isArray(data)) {
      // convert array to map-like for supported currencies
      const map = {};
      data.forEach(item => { if (item && item.quote) currencies.set(item.quote, item.rate); });
    } else {
      console.error('Unexpected currency response format:', data);
      return;
    }
    lastUpdate = Date.now();
    console.log('Currency rates updated', new Date(lastUpdate).toISOString());
  } catch (err) {
    console.error('Failed to fetch currency rates:', err && err.name === 'AbortError' ? 'timeout' : err);
    // keep last-known rates
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
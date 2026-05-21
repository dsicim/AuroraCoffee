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
function currencyToDecimal(currency, price) {
    const mille = ({ "USD": ",", "EUR": ",", "GBP": ",", "TRY": ".", "NOK": "", "SEK": "", "IRR": "", "RUB": "", "CHF": "," }[currency] || ",");
    const punctuation = ({ "USD": ".", "EUR": ".", "GBP": ".", "TRY": ",", "NOK": ".", "SEK": ".", "IRR": ".", "RUB": ".", "CHF": "." }[currency] || ".");
    // mille should be printed on every thousand, and punctuation should be printed on every decimal
    let priceStr = price.toFixed(2).replace(".", punctuation);
    let priceidx = priceStr.length - 3;
    priceidx = priceidx - 3;
    while (priceidx > 0) {
        priceStr = priceStr.slice(0, priceidx) + mille + priceStr.slice(priceidx);
        priceidx = priceidx - 3;
    }
    return priceStr;
}
function currencyToSymbol(currency, price, negative = false) {
    price = parseFloat(price);
    const symbol = ({ "USD": "$", "EUR": "€", "GBP": "£", "TRY": "₺", "NOK": "NOK ", "SEK": "SEK ", "IRR": "IRR ", "RUB": " ₽", "CHF": " Fr." }[currency] || currency);
    if (["CHF", "RUB"].includes(currency)) return (negative ? "-" : "") + currencyToDecimal(currency, price) + symbol;
    else return symbol + (negative ? "-" : "") + currencyToDecimal(currency, price);
}
module.exports = { GetCurrencies, currencyToDecimal, currencyToSymbol};
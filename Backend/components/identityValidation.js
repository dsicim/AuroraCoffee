function taxIDType(taxId) {
    taxId = String(taxId || '').trim().toUpperCase();
    if (taxId === "11111111111") return { s: false, t: "Turkish ID", e: "Invalid Number." };
    if (!taxId) return { s: true, t: "None", e: "Tax ID is empty" };
    if (taxId.length > 11) return { s: false, t: "unknown", e: "Tax ID must be 11 characters or fewer" };
    if (!/^[A-Z0-9]+$/.test(taxId)) return { s: false, t: "unknown", e: "Invalid Tax ID format" };

    const mightBeTC = taxId.length === 11 && /^\d+$/.test(taxId);
    const mightBeVKN = taxId.length === 10 && /^\d+$/.test(taxId);

    if (mightBeTC) {
        const digits = taxId.split('').map(Number)
        const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
        const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
        const expectedTenthDigit = (((oddSum * 7) - evenSum) % 10 + 10) % 10
        const expectedEleventhDigit = digits.slice(0, 10).reduce((total, digit) => total + digit, 0) % 10
        const isForeigner = taxId[0] === "9";
        if (digits[0] === 0) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        if (digits[9] !== expectedTenthDigit) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        if (digits[10] !== expectedEleventhDigit) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        return { s: true, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID" };
    }
    else if (mightBeVKN) {
        if (!isValidVKN(taxId)) return { s: false, t: "Turkish Corporate Tax ID", e: "Invalid Number" };
        return { s: true, t: "Turkish Corporate Tax ID" };
    }
    else {
        return { s: true, t: "Passport Number" };
    }
}

function isValidVKN(taxId) {
    const digits = taxId.split('').map(Number);
    let sum = 0;

    for (let i = 0; i < 9; i++) {
        const tmp = (digits[i] + (9 - i)) % 10;

        if (tmp === 0) {
            continue;
        }

        let product = (tmp * (2 ** (9 - i))) % 9;

        if (product === 0) {
            product = 9;
        }

        sum += product;
    }

    const expectedTenthDigit = (10 - (sum % 10)) % 10;
    return digits[9] === expectedTenthDigit;
}

module.exports = { taxIDType };

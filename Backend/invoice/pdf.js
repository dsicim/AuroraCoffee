const pdfkit = require("pdfkit");
const fs = require("fs");
const path = require("path");

const logo = fs.readFileSync(path.join(__dirname, "invoicelogo.png"));
const logoHeight = 400;
const logoWidth = 803;

function currencyToDecimal(currency, price) {
    const mille = ({ "USD": ",", "EUR": ",", "GBP": ",", "TRY": ".", "NOK": "", "RUB": "", "CHF": "," }[currency] || ",");
    const punctuation = ({ "USD": ".", "EUR": ".", "GBP": ".", "TRY": ",", "NOK": ".", "RUB": ".", "CHF": "." }[currency] || ".");
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
    const symbol = ({ "USD": "$", "EUR": "€", "GBP": "£", "TRY": "₺", "NOK": "NOK ", "RUB": " ₽", "CHF": " Fr." }[currency] || currency);
    if (["CHF", "RUB"].includes(currency)) return (negative?"-":"")+currencyToDecimal(currency, price) + symbol;
    else return symbol + (negative?"-":"")+currencyToDecimal(currency, price);
}
async function generatePDF(orderData, print = false) {
    const document = await new Promise((resolve, reject) => {
        const margin = 28;
        const doc = new pdfkit({size: "A4", margin: margin});
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.registerFont("InvoiceBold", path.join(__dirname, "Manrope-Bold.ttf"));
        doc.registerFont("InvoiceLight", path.join(__dirname, "Manrope-Light.ttf"));
        doc.registerFont("InvoiceMedium", path.join(__dirname, "Manrope-Medium.ttf"));
        doc.registerFont("InvoiceRegular", path.join(__dirname, "Manrope-Regular.ttf"));

        const order = orderData.id;
        const customername = orderData.details.billingAddress.name + " " + orderData.details.billingAddress.surname;
        const currency = orderData.details.currency;
        const installment = orderData.details.installment.months;
        orderData.created_at = orderData.created_at instanceof Date ? orderData.created_at : new Date(orderData.created_at);
        const date = orderData.created_at.toISOString().slice(0,10).split("-").reverse().join(".");
        function getLogoScale(prefHeight) {
            const scale = prefHeight / logoHeight;
            return [logoWidth * scale, logoHeight * scale];
        }
        function displayHeader(nextpages = false) {
            if (!nextpages) {
                doc.font("InvoiceBold").fontSize(20);
                doc.image(logo, margin, margin+8, {
                    fit: getLogoScale(100),
                    align: "left",
                    valign: "top",
                });
                doc.moveDown(4);
                const addressHeight = doc.y;
                doc.font("InvoiceMedium").fontSize(12).text("Aurora Coffee Roastery\nCS308 Online Store", { align: "left" });
                doc.font("InvoiceLight").fontSize(12).text("Sabancı University, Orta Mh, Üniversite Cd,\n34956 Tuzla/İstanbul, Türkiye", { align: "left", width: 300 });
                const usedToBe = doc.y;
                doc.y = margin + 8;
                doc.moveDown(0);
                doc.font("InvoiceMedium").fontSize(16).text("Invoice", { align: "right" });
                doc.font("InvoiceMedium").fontSize(12).text("Order ID: "+order, { align: "right"});
                doc.font("InvoiceMedium").fontSize(12).text("Issue Date: "+date, { align: "right"});
                doc.font("InvoiceMedium").fontSize(12).text("Due Date: "+date, { align: "right"});
                doc.font("InvoiceBold").fontSize(14).text("Amount Due: "+currencyToSymbol(currency, orderData.details.price.paid), { align: "right"});
                const rightHeight = doc.y;
                doc.y = addressHeight;
                doc.x = 280;
                doc.font("InvoiceRegular").fontSize(12).text("Billed to", { align: "left" });
                doc.font("InvoiceMedium").fontSize(12).text(customername, { align: "left" });
                const addr = orderData.details.billingAddress;
                doc.font("InvoiceLight").fontSize(12).text(addr.address+"\n"+(addr.address2?addr.address2+"\n":"")+addr.zip+" "+addr.city+"/"+addr.province+", "+addr.country+"\n"+addr.phone, { align: "left", width: 300 });
                doc.x = margin;
                if (rightHeight > doc.y) doc.y = rightHeight;
            }
            else {
                doc.y = margin + 8;
                doc.font("InvoiceMedium").fontSize(12).text("Order ID: "+order, { align: "right"});
                doc.font("InvoiceMedium").fontSize(12).text("Billed to: " + customername, { align: "right"});
                doc.y = margin;
                doc.font("InvoiceBold").fontSize(20);
                doc.image(logo, margin, margin+8, {
                    fit: getLogoScale(68),
                    align: "left",
                    valign: "top",
                });
                doc.moveDown(2.8);
                console.log("next page header", doc.y);
            }
        }
        displayHeader();
        let tableX = [];
        let alltableXs = [];
        function tableLayout(widths) {
            tableX = widths;
            tableX[0] = margin;
        }
        tableLayout([20, 190, 220, 300, 440]);
        doc.moveDown(0.5);
        function drawHeader(p=1,o=1) {
            doc.font("InvoiceLight").fontSize(12).text("Billed Items", { align: "left" });
            doc.moveUp(1);
            doc.font("InvoiceLight").fontSize(12).text("Page "+p+" of "+o, { align: "right" });
            doc.lineWidth(2).moveTo(20, doc.y+5).lineTo((doc.page.width-margin), doc.y+5).stroke();
            doc.moveDown(0.5);
            doc.font("InvoiceBold").fontSize(12).text("Item", tableX[0], doc.y, { align: "left" });
            doc.moveUp(1);
            doc.font("InvoiceBold").fontSize(12).text("Qty", tableX[1], doc.y, { align: "left" });
            doc.moveUp(1);
            doc.font("InvoiceBold").fontSize(12).text("Tax", tableX[2], doc.y, { align: "left" });
            doc.moveUp(1);
            doc.font("InvoiceBold").fontSize(12).text("Unit Price", tableX[3], doc.y, { align: "left" });
            doc.moveUp(1);
            doc.font("InvoiceBold").fontSize(12).text("Price", tableX[4], doc.y, { align: "left" });
            doc.moveDown(0.3);
            doc.lineWidth(1).moveTo(20, doc.y).lineTo((doc.page.width-margin), doc.y).stroke();
        }

        const array = orderData.details.products.map(p => {
            return { n: p.product_name, o: p.optionstext, q: p.quantity, t: p.tax, a: (Math.round(p.taxAmount*100)/100), u: Math.round(p.subtotal*100)/100, p: (Math.round(p.subtotal*100)/100)*p.quantity, ut: p.product_price, pt: p.product_price*p.quantity };
        })

        let pages = 0;
        let curridx = 0;
        let space = 0;
        while (curridx < array.length) {
            pages++;
            tableLayout(measureRowWidth(curridx, curridx+1));
            let c = amountOfRowsThatFit(array, curridx, pages == 1 ? doc.y+45.8976 : 143.07360000000006);
            space = c.s;
            c = c.c;
            tableLayout(measureRowWidth(curridx, curridx+c));
            let cn = amountOfRowsThatFit(array, curridx, pages == 1 ? doc.y+45.8976 : 143.07360000000006);
            space = cn.s;
            cn = cn.c;
            if (cn != c) {
                c = cn;
                tableLayout(measureRowWidth(curridx, curridx+c));
                cn = amountOfRowsThatFit(array, curridx, pages == 1 ? doc.y+45.8976 : 143.07360000000006);
                space = cn.s;
                cn = cn.c;
                if (cn != c) {
                    c = cn;
                    tableLayout(measureRowWidth(curridx, curridx+c));
                }
            }
            alltableXs.push(tableX);
            curridx = curridx + c;
        }
        tableLayout(alltableXs[0]);
        if (space <= (installment === 1 ? 170.47680000000014 : 209.8176000000003)) {
            pages++;
        }
        drawHeader(1, pages);
        const debuglines = false;
        function drawProduct(name, opts, qty, tax, taxAmount, unitPrice, price, unitPriceWT, priceWT, firstitem = false) {
            if (!firstitem) doc.lineWidth(1).moveTo(20, doc.y).lineTo((doc.page.width-margin), doc.y).stroke();
            doc.moveDown(0.2);
            const startY = doc.y;
            let endY = doc.y;
            if (debuglines) doc.lineWidth(1).moveTo(tableX[0], doc.y).lineTo(tableX[1] - 5, doc.y).stroke();
            doc.font("InvoiceMedium").fontSize(12).text(name, tableX[0], doc.y, { align: "left", width: tableX[1] - tableX[0] - 5 });
            if (opts && opts.length > 0) doc.font("InvoiceLight").fontSize(12).text(opts, tableX[0], doc.y, { align: "left", width: tableX[1] - tableX[0] - 5 });
            if (doc.y > endY) endY = doc.y;
            doc.y = startY;
            if (debuglines) doc.lineWidth(1).moveTo(tableX[1], doc.y).lineTo(tableX[2] - 5, doc.y).stroke();
            doc.font("InvoiceRegular").fontSize(12).text(qty.toString(), tableX[1], doc.y, { align: "left", width: tableX[2] - tableX[1] - 5 });
            if (doc.y > endY) endY = doc.y;
            doc.y = startY;
            if (debuglines) doc.lineWidth(1).moveTo(tableX[2], doc.y).lineTo(tableX[3] - 5, doc.y).stroke();
            doc.font("InvoiceRegular").fontSize(12).text(tax+"%", tableX[2], doc.y, { align: "left", width: tableX[3] - tableX[2] - 5 });
            doc.font("InvoiceLight").fontSize(12).text(currencyToSymbol(currency, taxAmount), tableX[2], doc.y, { align: "left", width: tableX[3] - tableX[2] - 5 });
            if (doc.y > endY) endY = doc.y;
            doc.y = startY;
            if (debuglines) doc.lineWidth(1).moveTo(tableX[3], doc.y).lineTo(tableX[4] - 5, doc.y).stroke();
            doc.font("InvoiceRegular").fontSize(12).text(currencyToSymbol(currency, unitPrice), tableX[3], doc.y, { align: "left", width: tableX[4] - tableX[3] - 5 });
            doc.font("InvoiceLight").fontSize(12).text(currencyToSymbol(currency, unitPriceWT) + " with tax", tableX[3], doc.y, { align: "left", width: tableX[4] - tableX[3] - 5 });
            if (doc.y > endY) endY = doc.y;
            doc.y = startY;
            if (debuglines) doc.lineWidth(1).moveTo(tableX[4], doc.y).lineTo((doc.page.width-margin), doc.y).stroke();
            doc.font("InvoiceBold").fontSize(12).text(currencyToSymbol(currency, price), tableX[4], doc.y, { align: "left", width: (doc.page.width-margin) - tableX[4] });
            doc.font("InvoiceLight").fontSize(12).text(currencyToSymbol(currency, priceWT) + " with tax", tableX[4], doc.y, { align: "left", width: (doc.page.width-margin) - tableX[4] });
            if (doc.y > endY) endY = doc.y;
            doc.y = endY;
            doc.moveDown(0.2);
        }
        function measureRowHeight(name, opts, qty, tax, taxAmount, unitPrice, price, unitPriceWT, priceWT) {
            const heights = [];
            doc.font("InvoiceMedium").fontSize(12);
            const itemNameH = doc.heightOfString(name, { width: tableX[1] - tableX[0] - 5, align: "left" });
            doc.font("InvoiceLight").fontSize(12);
            const itemOptsH = opts && opts.length > 0 ? doc.heightOfString(opts, { width: tableX[1] - tableX[0] - 5, align: "left" }) : 0;
            heights.push(itemNameH + itemOptsH);
            doc.font("InvoiceRegular").fontSize(12);
            const itemQtyC = doc.heightOfString(qty.toString(), { width: tableX[2] - tableX[1] - 5, align: "left" });
            heights.push(itemQtyC);
            doc.font("InvoiceRegular").fontSize(12);
            const itemTaxH = doc.heightOfString(tax+"%", { width: tableX[3] - tableX[2] - 5, align: "left" });
            doc.font("InvoiceLight").fontSize(12);
            const itemTaxAmountH = doc.heightOfString(currencyToSymbol(currency, taxAmount), { width: tableX[3] - tableX[2] - 5, align: "left" });
            heights.push(itemTaxH + itemTaxAmountH);
            doc.font("InvoiceRegular").fontSize(12);
            const itemUnitH = doc.heightOfString(currencyToSymbol(currency, unitPrice), { width: tableX[4] - tableX[3] - 5, align: "left" });
            doc.font("InvoiceLight").fontSize(12);
            const itemUnitTH = doc.heightOfString(currencyToSymbol(currency, unitPriceWT) + " with tax", { width: tableX[4] - tableX[3] - 5, align: "left" });
            heights.push(itemUnitH + itemUnitTH);
            doc.font("InvoiceBold").fontSize(12);
            const itemH = doc.heightOfString(currencyToSymbol(currency, price), { width: (doc.page.width-margin) - tableX[4], align: "left" });
            doc.font("InvoiceLight").fontSize(12);
            const itemTH = doc.heightOfString(currencyToSymbol(currency, priceWT) + " with tax", { width: (doc.page.width-margin) - tableX[4], align: "left" });
            heights.push(itemH + itemTH);
            const spacer = doc.currentLineHeight() * 0.4;
            return Math.max(...heights) + spacer;
        }
        function measureRowWidth(idx, end) {
            function measureRowColumns(name, opts, qty, tax, taxAmount, unitPrice, price, unitPriceWT, priceWT) {
                const widths = [];
                const spacer = 5;
                doc.font("InvoiceRegular").fontSize(12);
                const itemQtyC = doc.widthOfString(qty.toString(), { align: "left",lineBreak: false, ellipsis: false });
                widths.push(Math.max(itemQtyC,20.724) + spacer);
                doc.font("InvoiceRegular").fontSize(12);
                const itemTaxW = doc.widthOfString(tax+"%", { align: "left",lineBreak: false, ellipsis: false });
                doc.font("InvoiceLight").fontSize(12);
                const itemTaxAmountW = doc.widthOfString(currencyToSymbol(currency, taxAmount), { align: "left" ,lineBreak: false, ellipsis: false });
                widths.push(Math.max(itemTaxW,itemTaxAmountW,19.998) + spacer);
                doc.font("InvoiceRegular").fontSize(12);
                const itemUnitW = doc.widthOfString(currencyToSymbol(currency, unitPrice), { align: "left",lineBreak: false, ellipsis: false });
                doc.font("InvoiceLight").fontSize(12);
                const itemUnitTW = doc.widthOfString(currencyToSymbol(currency, unitPriceWT) + " with tax", { align: "left",lineBreak: false, ellipsis: false });
                widths.push(Math.max(itemUnitW,itemUnitTW,56.874) + spacer);
                doc.font("InvoiceBold").fontSize(12);
                const itemW = doc.widthOfString(currencyToSymbol(currency, price), { align: "left",lineBreak: false, ellipsis: false });
                doc.font("InvoiceLight").fontSize(12);
                const itemTW = doc.widthOfString(currencyToSymbol(currency, priceWT) + " with tax", { align: "left",lineBreak: false, ellipsis: false });
                widths.push(Math.max(itemW,itemTW,29.766000000000005) + spacer);
                return widths;
            }
            let max = [0,0,0,0];
            for (let i = idx; i < end; i++) {
                const row = measureRowColumns(array[i].n, array[i].o, array[i].q, array[i].t, array[i].a, array[i].u, array[i].p, array[i].ut, array[i].pt);
                for (let j = 0; j < max.length; j++) {
                    max[j] = Math.max(max[j], row[j]);
                }
            }
            let total = margin + 31.064;
            const lastColumn = max[3];
            for (let i = 0; i < max.length; i++) {
                total = total + max[i];
                max[i] = total - max[i];
            }
            const toAdd = (doc.page.width - margin) - (max[3] + lastColumn - 5);
            for (let i = 0; i < max.length; i++) {
                max[i] = max[i] + toAdd;
            }
            return [20,...max];
        }
        function amountOfRowsThatFit(array, idx, y = doc.y) {
            let counter = 0;
            let spaceLeft = (doc.page.height-margin) - y;
            while (idx + counter < array.length) {
                const rowHeight = measureRowHeight(array[idx+counter].n, array[idx+counter].o, array[idx+counter].q, array[idx+counter].t, array[idx+counter].a, array[idx+counter].u, array[idx+counter].p, array[idx+counter].ut, array[idx+counter].pt);
                if (rowHeight > spaceLeft) break;
                spaceLeft = spaceLeft - rowHeight;
                counter++;
            }
            return {c: counter, s: spaceLeft};
        }
        let pageCount = 1;
        array.forEach((x,i) => {
            const rowHeight = measureRowHeight(x.n, x.o, x.q, x.t, x.a, x.u, x.p, x.ut, x.pt);
            if (doc.y + rowHeight > (doc.page.height - margin)) {
                doc.addPage();
                pageCount++;
                displayHeader(true);
                tableLayout(alltableXs[pageCount-1]);
                drawHeader(pageCount, pages);
            }
            const bef = doc.y;
            drawProduct(x.n, x.o, x.q, x.t, x.a, x.u, x.p, x.ut, x.pt);
        });
        doc.x = margin;
        const spaceLeft = (doc.page.height-margin) - doc.y;
        let newpage = false;
        if (spaceLeft <= (installment === 1 ? 170.47680000000014 : 209.8176000000003)) {
            doc.addPage();
            newpage = true;
            displayHeader(true);
        }
        const beforeSummary = doc.y;
        if (!newpage) doc.moveDown(1.5);
        else {
            doc.font("InvoiceLight").fontSize(12).text("Page "+pages+" of "+pages, { align: "right" });
            doc.moveUp(1);
        }
        doc.font("InvoiceLight").fontSize(12).text("Bill Summary", { align: "left" });
        doc.lineWidth(2).moveTo(20, doc.y+5).lineTo((doc.page.width-margin), doc.y+5).stroke();
        doc.moveDown(0.5);
        doc.font("InvoiceBold").fontSize(14);
        const totalWidth = doc.widthOfString(currencyToSymbol(currency, orderData.details.price.paid), { align: "left",lineBreak: false, ellipsis: false });
        function insertSummaryLine(key, value, bold = false) {
            doc.font(bold ? "InvoiceMedium" : "InvoiceRegular").fontSize(bold?14:12).text(`${key}: `, margin, doc.y, { align: "right", width: (doc.page.width - margin) - totalWidth - margin - 10 });
            doc.moveUp(1);
            doc.font(bold ? "InvoiceBold" : "InvoiceMedium").fontSize(bold?14:12).text(value, (doc.page.width - margin)-totalWidth, doc.y, { align: "left" });
            doc.moveDown(0.2);
        }
        insertSummaryLine("Subtotal", currencyToSymbol(currency, orderData.details.price.subtotal));
        insertSummaryLine("Tax", currencyToSymbol(currency, orderData.details.price.tax));
        insertSummaryLine("Discount", currencyToSymbol(currency, 0, false));
        insertSummaryLine("Shipping", currencyToSymbol(currency, orderData.details.price.shipping));
        insertSummaryLine("Subtotal with taxes", currencyToSymbol(currency, orderData.details.price.subtotal + orderData.details.price.tax));
        if (installment > 1) {
            insertSummaryLine("Installment Interest", currencyToSymbol(currency, orderData.details.price.installment));
            insertSummaryLine("Amount due per month for "+installment+" months", currencyToSymbol(currency, orderData.details.installment.permonth));
        }
        insertSummaryLine("Amount Due", currencyToSymbol(currency, orderData.details.price.paid), true);
        doc.end();
    });
    if (print) {
        fs.writeFile("test.pdf", document, err => {
            if (err) console.error("Error writing PDF file:", err);
            else console.log("PDF file written successfully");
        });
    }
    else {
        return document;
    }
}
module.exports = {generatePDF};
const nodemailer = require('nodemailer');
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

async function sendEmail(to, subject, body) {
    const mailcontent = {
        from: {
            name: "Aurora Coffee",
            address: config.mail.from,
        },
        to: to,
        replyTo: config.mail.reply,
        subject: subject,
        html: body
    };
    nodemailer.createTransport({
        host: 'smtp.gmail.com',
        auth: {
            user: config.mail.user,
            pass: config.mail.pass
        }
    }).sendMail(mailcontent, function (error, info) {
        if (error) {
            return {s:false, d:error};
        } else {
            return {s:true, d:info};
        }
    });
}
module.exports = { sendEmail };
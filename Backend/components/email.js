const nodemailer = require('nodemailer');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

async function sendEmail(to, subject, body, attachments = []) {
    const mailcontent = {
        from: {
            name: "Aurora Coffee",
            address: config.mail.from,
        },
        to: to,
        replyTo: config.mail.reply,
        subject: subject,
        html: body,
        attachments: attachments.map(att => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
            contentDisposition: "attachment" // Ensure the attachment is treated as a file attachment, not inline
        }))
    };
    const mail = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        auth: {
            user: config.mail.user,
            pass: config.mail.pass
        }

    })
    return new Promise((resolve) => {
        mail.sendMail(mailcontent, function (error, info) {
            if (error) {
                resolve(error);
            } else {
                resolve(info);
            }
        });
    });
}
module.exports = { sendEmail };
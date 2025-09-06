const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

client.on('qr', qr => {
    qrcode.toDataURL(qr, (err, url) => {
        console.log("📷 افتح الرابط ده في المتصفح عشان تشوف QR:");
        console.log(url);
    });
});

client.on('ready', () => {
    console.log('✅ البوت جاهز!');
});

client.on('message', message => {
    if (message.body === '!test') {
        message.reply('البوت شغال ✅');
    }
});

client.initialize();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createWorker } = require('tesseract.js');
const fs = require('fs');

// إعداد واتساب
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot is ready!');
});

// رقم الأدمن (انت) بصيغة دولية
const ADMIN_ID = "201024648668@c.us"; // +20 1024648668

let lists = {};       // جميع الـ lists
let tempStorage = {}; // تخزين مؤقت بعد OCR
const LISTS_FILE = 'lists.json';

// 📌 دعاية ثابتة
const FOOTER = "\n\n🔹 Powered by: Abdallah Naser Ahmed Hussein\n📞 +20 1024648668";

// 📂 تحميل الـ lists من ملف عند تشغيل البوت
if (fs.existsSync(LISTS_FILE)) {
    try {
        lists = JSON.parse(fs.readFileSync(LISTS_FILE, 'utf8'));
        console.log("📂 Lists loaded from file.");
    } catch (err) {
        console.error("⚠️ Error reading lists.json:", err);
    }
}

// 🔄 حفظ الـ lists في ملف
function saveLists() {
    fs.writeFileSync(LISTS_FILE, JSON.stringify(lists, null, 2), 'utf8');
}

client.on('message', async message => {
    const isGroup = message.from.endsWith("@g.us");
    const isFromAdmin = message.from === ADMIN_ID;

    // 1) استلام صورة في الخاص (OCR)
    if (message.hasMedia && isFromAdmin) {
        const media = await message.downloadMedia();
        const buffer = Buffer.from(media.data, 'base64');

        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(buffer);
        await worker.terminate();

        // استخراج أرقام 11 رقم
        const numbers = text.match(/\d{11}/g) || [];
        if (numbers.length) {
            tempStorage[message.from] = numbers;
            message.reply(`✅ OCR done.\n📋 Numbers saved temporarily.\n\n❓ Please type a name for the new list:` + FOOTER);
        } else {
            message.reply("⚠️ No 11-digit numbers found in the image." + FOOTER);
        }
    }

    // 2) تخزين list جديدة بعد التسمية
    else if (tempStorage[message.from] && isFromAdmin) {
        const listName = message.body.trim();
        lists[listName] = { numbers: tempStorage[message.from], date: new Date().toLocaleString() };
        delete tempStorage[message.from];
        saveLists();
        message.reply(`✅ New list created: *${listName}* with ${lists[listName].numbers.length} numbers.\n📅 Date: ${lists[listName].date}` + FOOTER);
    }

    // 3) إضافة list في الجروب
    else if (message.body.startsWith("add list") && isGroup) {
        const listName = message.body.split(" ")[2];
        if (lists[listName]) {
            let added = 0;
            for (const num of lists[listName].numbers) {
                try {
                    await client.groupAdd(message.from, [`${num}@c.us`]);
                    added++;
                } catch {
                    // لو الرقم قافل الإضافة → ابعتله لينك الجروب
                    const invite = await client.groupInviteCode(message.from);
                    await client.sendMessage(`${num}@c.us`, `📩 Join the group via this link: https://chat.whatsapp.com/${invite}`);
                }
            }
            message.reply(`✅ Tried to add list *${listName}* (${added} added).` + FOOTER);
        } else {
            message.reply("⚠️ List not found." + FOOTER);
        }
    }

    // 4) عرض كل الـ lists
    else if (message.body === "show lists" && isFromAdmin) {
        if (Object.keys(lists).length === 0) {
            message.reply("📂 No lists available." + FOOTER);
        } else {
            let reply = "📂 All saved lists:\n\n";
            for (const name in lists) {
                reply += `- ${name} (${lists[name].numbers.length} numbers) 📅 ${lists[name].date}\n`;
            }
            reply += FOOTER;
            message.reply(reply);
        }
    }

    // 5) عرض list معينة
    else if (message.body.startsWith("show list") && isFromAdmin) {
        const listName = message.body.split(" ")[2];
        if (lists[listName]) {
            message.reply(`📋 List *${listName}* (${lists[listName].numbers.length} numbers)\n📅 ${lists[listName].date}\n\n${lists[listName].numbers.join("\n")}` + FOOTER);
        } else {
            message.reply("⚠️ List not found." + FOOTER);
        }
    }

    // 6) مسح list
    else if (message.body.startsWith("delete list") && isFromAdmin) {
        const listName = message.body.split(" ")[2];
        if (lists[listName]) {
            delete lists[listName];
            saveLists();
            message.reply(`🗑️ List *${listName}* deleted.` + FOOTER);
        } else {
            message.reply("⚠️ List not found." + FOOTER);
        }
    }

    // 7) help
    else if (message.body === "help" && isFromAdmin) {
        const helpText = `
📖 Available Commands:

📷 Send image → OCR will detect 11-digit numbers.
🆕 [type a name] → save new list after OCR.
📋 show lists → show all saved lists.
📋 show list <name> → show a specific list.
➕ add list <name> → add numbers to group.
🗑️ delete list <name> → delete a list.
ℹ️ help → show this help menu.
        `;
        message.reply(helpText + FOOTER);
    }
});

client.initialize();

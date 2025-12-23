// Quantum Health Care WhatsApp Bot
// FULL FINAL VERSION (Text + Voice Handling + Doctors + Symptoms + Anti-Spam)

const {
  default: makeWASocket,
  useSingleFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const fs = require("fs");
const axios = require("axios");

const { state, saveState } = useSingleFileAuthState("./auth.json");

const WIT_API_KEY = "PASTE_YOUR_WIT_AI_KEY_HERE"; // ← tumhari wit.ai key

// Memory to avoid repeat replies
const repliedUsers = new Set();

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveState);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        startBot();
      }
    }
    if (connection === "open") {
      console.log("✅ Bot Connected Successfully");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const user = msg.key.remoteJid;

    // ❌ agar pehle reply ho chuka hai → chup
    if (repliedUsers.has(user)) return;

    // 📞 CALL AUTO REPLY
    if (msg.message.callLogMesssage || msg.message.call) {
      repliedUsers.add(user);
      await sock.sendMessage(user, {
        text:
`📞 Calls receive nahi hoti
Please WhatsApp TEXT karein 🙏

🎤 Voice notes support nahi hotay
Baraye meherbani apni takleef TEXT me likhein

— Quantum Health Care`
      });
      return;
    }

    // 🎤 VOICE NOTE HANDLING
    if (msg.message.audioMessage) {
      repliedUsers.add(user);
      await sock.sendMessage(user, {
        text:
`🎤 Voice notes support nahi hotay
Baraye meherbani apni takleef
TEXT me likhein. Shukriya 🙏`
      });
      return;
    }

    // 📝 TEXT MESSAGE
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (!text) return;

    repliedUsers.add(user);

    const reply = detectDoctor(text.toLowerCase());

    await sock.sendMessage(user, { text: reply });
  });
}

// 🧠 SYMPTOMS → DOCTOR LOGIC
function detectDoctor(text) {
  // SKIN
  if (text.match(/skin|khujli|daane|rash|acne|fungal/)) {
    return doctorMsg(
      "Dr Zeeshan",
      "Skin Specialist",
      "Fee: 1000",
      "Mon–Sat",
      "Quantum Health Care"
    );
  }

  // GASTRO + GENERAL
  if (text.match(/pet|gas|ulcer|vomit|diarrhea|bukhar|fever/)) {
    return doctorMsg(
      "Dr Salman",
      "Gastro + General Physician",
      "Fee: 1000",
      "Mon–Sat",
      "Quantum Health Care"
    );
  }

  // ENT
  if (text.match(/kan|naak|gala|ear|nose|throat/)) {
    return doctorMsg(
      "Dr Ibrar",
      "ENT Specialist",
      "Fee: 1000",
      "Mon–Sat",
      "Quantum Health Care"
    );
  }

  // NEURO
  if (text.match(/headache|migraine|chakkar|brain|fits/)) {
    return doctorMsg(
      "Dr Awais Younas",
      "Neuro Specialist",
      "Fee: 1000",
      "Mon–Sat",
      "Quantum Health Care"
    );
  }

  // PSYCHOLOGIST
  if (text.match(/stress|depression|anxiety|neend|ghabrahat/)) {
    return `🧠 *Dr Hammad Khalif*
Psychologist Specialist

📅 Sheikhupura:
Mon, Wed, Sat | 4pm–6pm
📍 Jinnah Medical & Diagnostic Center

📅 Hafizabad:
Wed | 10am–2pm
📍 Sherazi Hospital

📌 Appointment ke liye reply karein`;
  }

  // PULMONOLOGIST
  if (text.match(/saans|asthma|cough|lungs|tb/)) {
    return `🫁 *Dr Hafiz M. Faisal Nadeem*
Pulmonologist Specialist

📅 Tue, Thu, Sat
⏰ 2pm–4pm
📍 Darul Barakat Hospital Sheikhupura

⏰ 4pm–6pm
📍 Sultan Hospital Sheikhupura

📌 Appointment ke liye reply karein`;
  }

  return `👋 Assalam o Alaikum
Quantum Health Care Center

Apni *takleef ya symptoms* likhein
taake sahi doctor suggest kiya ja sake 🙏`;
}

// 📄 DOCTOR MESSAGE FORMAT
function doctorMsg(name, spec, fee, days, loc) {
  return `👨‍⚕️ *${name}*
${spec}

💰 ${fee}
📅 ${days}
📍 ${loc}

📌 Appointment ke liye reply karein`;
}

startBot();

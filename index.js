// index.js — FINAL ALL‑IN‑ONE WHATSAPP AI BOT (FREE STACK)
// Roman Urdu replies | Voice STT (Wit.ai) | Urdu TTS | Session Lock (no spam)
// Doctors + Symptoms mapping | Appointment booking | Auto lock after done

require('dotenv').config();
const { default: makeWASocket, fetchLatestBaileysVersion, DisconnectReason, downloadMediaMessage, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const qrcode = require('qrcode-terminal');

// ================== CONFIG ==================
// WIT.AI TOKEN (USER PROVIDED – HARD CODED)
const WIT_API_KEY = 'FW4CMRGJI3NCFAMDRNEI7NTFUBWVFG55';

// ================== SESSION STATE ==================
// Per-user session to avoid repeat replies
const userSessions = {}; // { greeted, stage, locked, appointment }

// ================== DOCTORS & DATA ==================
const DOCTORS = {
  gastro: {
    name: 'Dr Salman Ahmad Ansari',
    specialty: 'Gastro + Consultant Physician',
    sheikhupura: { days: 'Monday, Wednesday, Thursday', time: '2pm to 4pm', fees: 1500, location: 'Luqman Hospital, Dil Chowk, Sheikhupura' },
  },
  skin: {
    name: 'Dr Zeeshan Nasir',
    specialty: 'Skin Specialist',
    sheikhupura: { days: 'Monday to Friday', time: '10am to 2pm', fees: 1000, location: 'Jinnah Medical & Diagnostic Center, Dil Chowk, Sheikhupura' },
    hafizabad: { days: 'Wednesday', time: '10am to 2pm', fees: 1000, location: 'Sherazi Hospital, Sargodha Road, Hafizabad' },
  },
  ent: {
    name: 'Dr Ibrar Asif',
    specialty: 'ENT Specialist',
    sheikhupura: { days: 'Monday to Thursday & Saturday', time: '3pm to 5pm', fees: 1000, location: 'Luqman Medical Center, Dil Chowk, Sheikhupura' },
    hafizabad: { days: 'Wednesday', time: '10am to 2pm', fees: 1000, location: 'Sherazi Hospital, Sargodha Road, Hafizabad' },
  },
  neuro: {
    name: 'Dr Awais Younas',
    specialty: 'Neurologist',
    sheikhupura: { days: 'Monday, Wednesday, Thursday', time: '7:00pm to 8:15pm', fees: '1500 ', location: 'Siddique Hospital, Sheikhupura' },
    sheikhupura_sat: { days: 'Saturday', time: '3:30pm to 6:30pm', fees: '1500 ', location: 'Siddique Hospital, Sheikhupura' },
    hafizabad: { days: 'Saturday', time: '10:30am to 2:30pm', fees: '1500 ', location: 'Saqib Bashir Hospital, Hafizabad' },
  },
  psych: {
    name: 'Dr Hammad Khalif',
    specialty: 'Psychologist',
    sheikhupura: { days: 'Monday, Wednesday, Saturday', time: '4pm to 6pm', fees: '1000 ', location: 'Jinnah Medical & Diagnostic Center, Sheikhupura' },
    hafizabad: { days: 'Wednesday', time: '10am to 2pm', fees: '1000 ', location: 'Sherazi Hospital, Hafizabad' },
  },
  pulm: {
    name: 'Dr Hafiz M. Faisal Nadeem',
    specialty: 'Pulmonologist',
    sheikhupura_1: { days: 'Tuesday, Thursday, Saturday', time: '2pm to 4pm', fees: '1500 ', location: 'Darulbarakat Hospital, Sheikhupura' },
    sheikhupura_2: { days: 'Tuesday, Thursday, Saturday', time: '4pm to 6pm', fees: ' 1500', location: 'Sultan Hospital, Sheikhupura' },
  }
};

// ================== SYMPTOMS KEYWORDS ==================
const SYMPTOMS = {
  gastro: ['pait', 'pet', 'dard', 'upper', 'lower', 'acid', 'gas', 'ulcer', 'nausea', 'vomit', 'qabz', 'diarrhea'],
  skin: ['khujli', 'rash', 'daane', 'allergy', 'acne', 'eczema', 'fungal', 'skin', 'itch'],
  ent: ['gala', 'kan', 'naak', 'tonsil', 'sinus', 'ear', 'nose', 'throat', 'awaz'],
  neuro: ['sar', 'sir drd',  'headache', 'chakkar', 'fit', 'seizure', 'migraine', 'numb'],
  psych: ['tension', 'stress', 'anxiety', 'depression', 'neend', 'ghabrahat'],
  pulm: ['saans', 'breath', 'khansi', 'asthma', 'lungs', 'chest', 'Cough', 'Ulergy']
};

function detectSpecialty(text) {
  const t = text.toLowerCase();
  for (const key of Object.keys(SYMPTOMS)) {
    if (SYMPTOMS[key].some(k => t.includes(k))) return key;
  }
  return null;
}

function formatDoctor(key, city = 'sheikhupura') {
  const d = DOCTORS[key];
  if (!d) return '';
  let block = `\n👨‍⚕️ *${d.name}*\n🔹 ${d.specialty}`;
  Object.keys(d).forEach(k => {
    if (k.includes(city)) {
      const i = d[k];
      block += `\n📅 ${i.days}\n⏰ ${i.time}\n💰 Fees: ${i.fees}\n📍 ${i.location}`;
    }
  });
  return block;
}

// ================== VOICE STT (Wit.ai) ==================
async function speechToText(audioPath) {
  const audio = fs.readFileSync(audioPath);
  const res = await axios.post('https://api.wit.ai/speech?v=20210928', audio, {
    headers: { 'Authorization': `Bearer ${WIT_API_KEY}`, 'Content-Type': 'audio/ogg' }
  });
  return res.data.text || '';
}

// ================== TTS (Urdu – free gTTS via ffmpeg) ==================
function textToSpeechUrdu(text, outPath) {
  return new Promise((resolve, reject) => {
    const cmd = `gtts-cli "${text}" --lang ur --output ${outPath}`;
    exec(cmd, (err) => err ? reject(err) : resolve());
  });
}

// ================== MAIN ==================
// NOTE: Voice + Call fixes added (Baileys latest)
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state });
  
  sock.ev.on('creds.update', saveCreds);


sock.ev.on('messages.upsert', async ({ messages }) => {
const msg = messages[0];
if (!msg || !msg.message || msg.key.fromMe) return;


const sender = msg.key.remoteJid;


if (!userSessions[sender]) {
userSessions[sender] = { greeted: false, stage: 'start', locked: false, appointment: {} };
}
    // LOCK MODE: no replies at all
    if (userSessions[sender].locked) return;

    // CALL AUTO-CUT + TEXT
    if (msg.message?.callLogMessage) {
      await sock.sendMessage(sender, { text: 'Missed call note ho gai. Baraye meherbani WhatsApp par apni takleef likhein.' });
      return;
    }

    // GREETING (ONCE)
    if (!userSessions[sender].greeted) {
      await sock.sendMessage(sender, { text: 'Asslamo-Alaikum 🙏\nMain AI Bot hoon.\nDr ka naam ya apni takleef batayein ta ke main madad kar sakoon. Shukriya.' });
      userSessions[sender].greeted = true;
      userSessions[sender].stage = 'symptoms';
      return;
    }

    let text = '';

    // VOICE NOTE
    if (msg.message.audioMessage) {
      try {
        const file = await downloadMediaMessage(msg, 'buffer', {});
        const audioPath = path.join(__dirname, 'voice.ogg');
        fs.writeFileSync(audioPath, file);
        text = await speechToText(audioPath);
      } catch (e) {
        await sock.sendMessage(sender, { text: 'Aapki voice clear nahi aa saki 😕 Baraye meherbani text likhein.' });
        return;
      }
    } else if (msg.message.conversation) {
      text = msg.message.conversation;
    }

    if (!text) return;

    // END WORDS → LOCK
    const endWords = ['thanks', 'shukriya', 'ok', 'theek'];
    if (endWords.some(w => text.toLowerCase().includes(w))) {
      userSessions[sender].locked = true;
      return;
    }

    // APPOINTMENT FLOW
    if (text.toLowerCase().includes('appointment')) {
      userSessions[sender].stage = 'appointment';
      await sock.sendMessage(sender, { text: 'Appointment ke liye apna *Naam*, *Address* aur *Contact Number* bhejein.' });
      return;
    }

    if (userSessions[sender].stage === 'appointment') {
      userSessions[sender].appointment.details = text;
      await sock.sendMessage(sender, { text: '✅ Appointment note ho gayi hai. Clinic staff jald rabta karega. Shukriya!' });
      userSessions[sender].locked = true; // STOP ALL FURTHER REPLIES
      return;
    }

    // SYMPTOMS → DOCTOR
    const spec = detectSpecialty(text);
    if (spec) {
      const city = text.toLowerCase().includes('hafiz') ? 'hafizabad' : 'sheikhupura';
      const reply = `Aapke symptoms se *${DOCTORS[spec].specialty}* relevant lagta hai.` + formatDoctor(spec, city) + '\n\nAgar appointment chahiye to "appointment" likhein.';
      await sock.sendMessage(sender, { text: reply });
      return;
    }

    // DEFAULT
    await sock.sendMessage(sender, { text: 'Zara apni takleef clear bata dein ya doctor ka naam likhein.' });
  });
}

start().catch(console.error);

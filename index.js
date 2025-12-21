const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const express = require("express");
const qrcode = require("qrcode-terminal");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("WhatsApp Bot Running");
});

app.listen(port, () => {
  console.log("Server Running on PORT:", port);
});

const { state, saveState } = useSingleFileAuthState("./auth.json");

async function start() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveState);

  sock.ev.on("messages.upsert", ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    sock.sendMessage(msg.key.remoteJid, {
      text: "🎤 Voice messages supported nahi — Please TEXT."
    });
  });
}

start();

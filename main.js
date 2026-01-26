const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const util = require('util');
const fs = require('fs');

// Simple Logger Implementation
const logFile = fs.createWriteStream('bot_logs.txt', { flags: 'a' });
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  const timestamp = new Date().toISOString();
  logFile.write(`[${timestamp}] INFO: ${util.format(...args)}\n`);
  originalLog.apply(console, args);
};

console.error = function (...args) {
  const timestamp = new Date().toISOString();
  logFile.write(`[${timestamp}] ERROR: ${util.format(...args)}\n`);
  originalError.apply(console, args);
};
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const config = require('./config/config');
const Helper = require('./utils/helper');

// Store contacts
const store = { contacts: {} };

// Load store
if (fs.existsSync('./baileys_store.json')) {
  try {
    const data = JSON.parse(fs.readFileSync('./baileys_store.json', 'utf-8'));
    store.contacts = data.contacts || {};
    console.log('[STORE] Loaded', Object.keys(store.contacts).length, 'contacts');
  } catch (e) {
    console.log('Failed to load store');
  }
}

// Save store every 10 seconds
setInterval(() => {
  fs.writeFileSync('./baileys_store.json', JSON.stringify(store, null, 2));
}, 10_000);

// Cleanup temp folder every minute
setInterval(() => {
  Helper.cleanTempFolder();
}, 60_000);

// Load features
const features = Helper.loadFeatures();
console.log(`📦 Loaded ${features.size} features`);

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    browser: ['Artifical Intelegent (fahmyzzx)', 'Chrome', '3.0'],
    markOnlineOnConnect: true
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('📱 Scan QR code!');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('🚀 Artifical Intelegent (fahmyzzx) ready!');
      console.log(`👑 Owner: ${config.ownerNumber}`);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    try {
      if (type !== 'notify') return;

      const m = messages[0];
      if (!m.message) return;

      const messageText = m.message.conversation ||
        m.message.extendedTextMessage?.text || '';
      const body = messageText.trim();
      const isFromMe = m.key.fromMe;
      const sender = m.key.participant || m.key.remoteJid;

      // Save contacts
      if (!isFromMe && sender && m.pushName) {
        if (!store.contacts[sender] || store.contacts[sender].name !== m.pushName) {
          store.contacts[sender] = { id: sender, name: m.pushName };
          console.log('[STORE] Saved contact:', sender, '→', m.pushName);
        }
      }

      // Check if owner
      const isOwner = isFromMe || sender.replace('@s.whatsapp.net', '') === config.ownerNumber;

      // Handle commands
      // Feature Mode Check
      const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

      if (body.startsWith(config.ownerPrefix) && isOwner) {
        const command = body.slice(1).split(' ')[0].toLowerCase();
        const feature = features.get(command);
        if (feature && feature.ownerOnly) {
          await feature.execute(m, sock);
        }
      } else if (body.startsWith(config.userPrefix)) {
        if (settings.mode === 'private' && !isOwner) {
          return; // Ignore if private mode and not owner
        }

        const command = body.slice(1).split(' ')[0].toLowerCase();
        const feature = features.get(command);
        if (feature && !feature.ownerOnly) {
          await feature.execute(m, sock);
        }
      }

    } catch (error) {
      console.error('Message Handler Error:', error.message);
    }
  });
}

connectToWhatsApp();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
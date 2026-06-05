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
const StoreService = require('./services/StoreService');
const MessageParser = require('./utils/MessageParser');
const RateLimitService = require('./services/RateLimitService');
const AfkService = require('./services/AfkService');
const Formatter = require('./utils/Formatter');
const AppError = require('./utils/AppError');

// Initialize Store Service
const storeService = new StoreService();
global.__STORE_SERVICE__ = storeService;
// Initialize Rate Limit Service (max 5 commands per minute per user)
const rateLimitService = new RateLimitService(60000, 5);
// Initialize AFK Service
const afkService = new AfkService();


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
    browser: ['Botwa DEV Mode v1', 'Chrome', '3.0'],
    markOnlineOnConnect: true
  });
  storeService.attachSocket(sock);

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
      await storeService.registerSelf(sock);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      const m = messages[0];
      if (!m || !m.message) return;

      storeService.captureMessage(m);

    try {

      // 1. Parse Message
      const parsed = MessageParser.parse(m, sock);
      const { 
        body, 
        command, 
        isCmd, 
        sender, 
        pushName, 
        isGroup, 
        remoteJid,
        contextInfo,
        quotedSender
      } = parsed;

      const isFromMe = m.key.fromMe;

      // 2. Save Contacts
      if (sender && pushName && !isFromMe) {
        await storeService.captureContact(sender, pushName);
      }

      const quotedContextJid = quotedSender 
        || contextInfo?.participant 
        || contextInfo?.remoteJid 
        || (isGroup ? null : remoteJid);

      if (quotedContextJid) {
        await storeService.captureContact(quotedContextJid, contextInfo?.pushName, {
          additionalJids: contextInfo?.mentionedJid || []
        });
      }

      // 3. Check Owner & Permissions (MOVED UP)
      // Fix owner checking - handle both @s.whatsapp.net and @lid formats
      const normalizedSender = sender.replace('@s.whatsapp.net', '').replace('@lid', '');
      const isOwner = isFromMe || normalizedSender === config.ownerNumber;

      // 4. Check AFK Status (Bot-Level) - Skip if owner
      if (!isOwner && afkService.isAfkActive()) {
        // Determine if user is interacting with bot
        const botJid = sock.user?.id;
        const isMentioned = botJid && parsed.mentions.includes(botJid);
        const isReplyToBot = parsed.quotedSender === botJid;
        const isPrivateChat = !parsed.isGroup;
        
        // If user interacts with bot (mention/reply/DM)
        if (isMentioned || isReplyToBot || isPrivateChat) {
          const afkInfo = afkService.getAfkInfo();
          const afkMessage = [
            Formatter.bold('fahmy sedang tidak aktif'),
            `Alasan: ${afkInfo.reason}`,
            `Durasi: ${afkInfo.duration}`,
            '',
            Formatter.italic('(Abaikan) Pesan ini otomatis karena fahmy sedang Tidak aktif.')
          ].join('\n');
          
          await sock.sendMessage(
            parsed.remoteJid,
            { text: afkMessage },
            { quoted: m }
          );
          // Always return early - don't process commands while AFK
          return;
        }
      }

      // 5. Log Command
      if (isCmd) {
        console.log(`[CMD] ${command} from ${pushName} (${sender.split('@')[0]})`);
      } else {
        // If not a command, ignore (unless we want to handle non-command messages later)
        return;
      }

      // Feature Check
      const feature = features.get(command);
      if (!feature) return;

      // 6. Rate Limiting Check
      // Only check for non-owner and valid commands
      if (!isOwner) {
        if (!rateLimitService.check(sender)) {
          console.warn(`[RATE LIMIT] ${sender} exceeded limit.`);
          // Optional: Send warning message (once per window ideally, but simple here)
          // await sock.sendMessage(remoteJid, { text: '⏳ Terlalu banyak request! Tunggu sebentar.' }, { quoted: m });
          return;
        }
      }

      // 7. Feature Handling
      // Feature Mode Check
      // Re-read settings every time? Okay but maybe cache later.
      const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

      // Permission Check
      if (feature.ownerOnly && !isOwner) {
        return; // Silent fail if not owner
      }

      // Mode Check
      if (settings.mode === 'private' && !isOwner && !feature.ownerOnly) {
        return; // Ignore in private mode
      }

      // Execute Feature with Parsed Data
      await feature.execute(m, sock, parsed);

    } catch (error) {
      if (error instanceof AppError) {
        // Operational error (User input error, etc) - Send standard warning
        // We use the parsed remoteJid if available, otherwise fallback to message key
        const jid = m?.key?.remoteJid;
        if (jid) {
            await sock.sendMessage(jid, { 
                text: `${Formatter.bold('❌ Error:')} ${error.message}` 
            }, { quoted: m });
        }
      } else {
        // Programming or System error - Log and obscure details
        console.error('[UNHANDLED FAILURE]', error);
        // Optional: Send generic message for unknown errors
        // await sock.sendMessage(m.key.remoteJid, { text: '❌ Terjadi kesalahan internal.' });
      }
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
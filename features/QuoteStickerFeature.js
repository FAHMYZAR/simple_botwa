const { QuoteGenerator } = require('qc-generator-whatsapp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const axios = require('axios');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class QuoteStickerFeature {
    constructor() {
        this.name = 'q';
        this.description = '_Reply quotly pesan_';
        this.ownerOnly = false;
    }

    async execute(m, sock, parsed) {
        const quoted = parsed.quoted;

        if (!quoted) {
            throw new AppError('Reply pesan yang ingin dijadikan stiker!');
        }

        await sock.sendMessage(parsed.remoteJid, { react: { text: '⏳', key: m.key } });

        const contextInfo = m.message.extendedTextMessage?.contextInfo;
        const isGroup = parsed.isGroup;

        // Get quoted sender JID
        const quotedSender = parsed.quotedSender || (isGroup ? contextInfo?.participant : parsed.remoteJid);
        
        console.log('[Q] ===== DEBUG INFO =====');
        console.log('[Q] Remote JID:', parsed.remoteJid);
        console.log('[Q] Quoted sender JID:', quotedSender);
        
        // Get name - PRIORITAS: store > pushName > WA API
        let name;

        // Helper: cari di store
        const findInStore = (jid) => {
            let storeContacts = {};
            try {
                const fs = require('fs');
                if (fs.existsSync('./baileys_store.json')) {
                    const data = JSON.parse(fs.readFileSync('./baileys_store.json', 'utf-8'));
                    storeContacts = data.contacts || {};
                }
            } catch (e) { }

            if (storeContacts[jid]?.name) return storeContacts[jid].name;
            const number = jid.split('@')[0];
            for (const [key, contact] of Object.entries(storeContacts)) {
                if (key.split('@')[0] === number && contact.name) return contact.name;
            }
            return null;
        };

        name = findInStore(quotedSender);
        if (!name && contextInfo?.pushName) name = contextInfo.pushName;
        if (!name) name = quotedSender.split('@')[0];

        // Get profile picture
        let ppBuffer = null;
        try {
            const ppUrl = await sock.profilePictureUrl(quotedSender, 'image').catch(() => null);
            if (ppUrl) {
                const response = await axios.get(ppUrl, {
                    responseType: 'arraybuffer',
                    timeout: 5000
                });
                ppBuffer = await sharp(Buffer.from(response.data)).resize(100, 100).png().toBuffer();
            }
        } catch (e) {
            console.log('[Q] No profile picture for:', quotedSender);
        }

        // Get text
        const text = quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.stickerMessage?.caption ||
            '';

        // Get media if exists
        let mediaBuffer = null;
        if (quoted.imageMessage) {
            mediaBuffer = await downloadMediaMessage(
                { message: { imageMessage: quoted.imageMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
        } else if (quoted.stickerMessage) {
            const stickerBuffer = await downloadMediaMessage(
                { message: { stickerMessage: quoted.stickerMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
            mediaBuffer = await sharp(stickerBuffer).png().toBuffer();
        }

        // Generate unique ID
        const uniqueId = parseInt(quotedSender.substring(0, 8), 16) || Math.floor(Math.random() * 999999);

        // Generate quote image
        const params = {
            type: 'quote',
            format: 'png',
            backgroundColor: '#1b2226',
            width: 512,
            height: 512,
            scale: 2,
            messages: [
                {
                    entities: [],
                    avatar: true,
                    from: {
                        id: uniqueId,
                        name: name,
                        photo: {
                            url: ppBuffer ? `data:image/png;base64,${ppBuffer.toString('base64')}` : 'https://i.ibb.co/2ds00c5/blank-profile.png',
                        }
                    },
                    text: text,
                    replyMessage: {},
                    media: mediaBuffer ? {
                        url: `data:image/png;base64,${mediaBuffer.toString('base64')}`,
                    } : undefined
                }
            ]
        };

        const generator = new QuoteGenerator();
        const quoteBuffer = await generator.generate(params);

        if (!quoteBuffer) {
            throw new AppError('Gagal generate stiker');
        }

        const sticker = await sharp(quoteBuffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp()
            .toBuffer();

        await sock.sendMessage(parsed.remoteJid, { react: { text: '', key: m.key } });

        await sock.sendMessage(parsed.remoteJid, {
            sticker: sticker
        }, { quoted: m });
    }
}

module.exports = QuoteStickerFeature;

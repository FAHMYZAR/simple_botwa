const { QuoteGenerator } = require('qc-generator-whatsapp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const axios = require('axios');

class QuoteStickerFeature {
    constructor() {
        this.name = 'q';
        this.description = '_Reply quotly pesan_';
        this.ownerOnly = false;
    }

    async execute(m, sock, args) {
        try {
            const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!quoted) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Reply pesan yang ingin dijadikan stiker!'
                });
                return;
            }

            await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

            const contextInfo = m.message.extendedTextMessage?.contextInfo;
            const isGroup = m.key.remoteJid.endsWith('@g.us');

            // Get quoted sender JID - FIXED LOGIC
            let quotedSender;
            if (isGroup) {
                // Di grup: participant adalah pengirim quoted message
                quotedSender = contextInfo?.participant;
            } else {
                // Di private chat:
                // participant di contextInfo adalah pengirim ASLI quoted message
                quotedSender = contextInfo?.participant || m.key.remoteJid;
            }

            console.log('[Q] ===== DEBUG INFO =====');
            console.log('[Q] Remote JID:', m.key.remoteJid);
            console.log('[Q] Is group:', isGroup);
            console.log('[Q] Context participant:', contextInfo?.participant);
            console.log('[Q] Context remoteJid:', contextInfo?.remoteJid);
            console.log('[Q] Quoted sender JID:', quotedSender);
            // console.log('[Q] My JID:', sock.user.id.split(':')[0] + '@s.whatsapp.net'); // sock.user might be undefined in some versions

            // Get name - PRIORITAS: store > pushName > WA API
            let name;

            // Access global store from main.js if exported or passed (assuming global available or pass it)
            // But usually 'store' is not global. Let's try to access it via module require if possible, 
            // OR relying on the feature execute params if we could pass it.
            // For now, let's assume we read from baileys_store.json if global.store is not available

            // Helper: cari di store dengan berbagai format JID
            const findInStore = (jid) => {
                // Check Baileys store if globally available or load manually
                let storeContacts = {};
                try {
                    const fs = require('fs');
                    if (fs.existsSync('./baileys_store.json')) {
                        const data = JSON.parse(fs.readFileSync('./baileys_store.json', 'utf-8'));
                        storeContacts = data.contacts || {};
                    }
                } catch (e) { }

                // Coba exact match dulu
                if (storeContacts[jid]?.name) {
                    return storeContacts[jid].name;
                }

                // Extract nomor dari JID
                const number = jid.split('@')[0];

                // Cari dengan nomor yang sama tapi format berbeda
                for (const [key, contact] of Object.entries(storeContacts)) {
                    const keyNumber = key.split('@')[0];
                    if (keyNumber === number && contact.name) {
                        return contact.name;
                    }
                }

                return null;
            };

            // 1. Cek store dulu (paling akurat karena dari pushName)
            name = findInStore(quotedSender);
            if (name) {
                console.log('[Q] Name from store:', name);
            }
            // 2. Cek pushName dari contextInfo
            else if (contextInfo?.pushName) {
                name = contextInfo.pushName;
                console.log('[Q] Name from pushName:', name);
            }
            // 3. Fallback ke sock.getName (if supported by implementation)
            else {
                // name = await sock.getName(quotedSender); // getName deprecated often
                name = quotedSender.split('@')[0]; // Simple fallback
                console.log('[Q] Name from fallback:', name);
            }

            console.log('[Q] Final name:', name);

            // Get profile picture - FORCE FRESH
            let ppBuffer = null;
            try {
                // Try catch profile picture
                const ppUrl = await sock.profilePictureUrl(quotedSender, 'image').catch(() => null);
                if (ppUrl) {
                    console.log('[Q] PP URL:', ppUrl);
                    const response = await axios.get(ppUrl, {
                        responseType: 'arraybuffer',
                        timeout: 5000
                    });
                    // Convert to PNG to ensure compatibility with QuoteGenerator
                    ppBuffer = await sharp(Buffer.from(response.data)).resize(100, 100).png().toBuffer();
                    console.log('[Q] PP downloaded & converted to PNG, size:', ppBuffer.length);
                }
            } catch (e) {
                console.log('[Q] No profile picture for:', quotedSender, e.message);
                ppBuffer = null;
            }

            // Get text
            const text = quoted.conversation ||
                quoted.extendedTextMessage?.text ||
                quoted.imageMessage?.caption ||
                quoted.stickerMessage?.caption ||
                '';

            // Get media if exists (support image & sticker)
            let mediaBuffer = null;
            if (quoted.imageMessage) {
                try {
                    mediaBuffer = await downloadMediaMessage(
                        { message: { imageMessage: quoted.imageMessage } },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                } catch (e) {
                    console.error('Failed to download image:', e);
                }
            } else if (quoted.stickerMessage) {
                try {
                    const stickerBuffer = await downloadMediaMessage(
                        { message: { stickerMessage: quoted.stickerMessage } },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    // Convert WebP sticker to PNG for QuoteGenerator
                    mediaBuffer = await sharp(stickerBuffer).png().toBuffer();
                    console.log('[Q] Sticker converted to PNG');
                } catch (e) {
                    console.error('Failed to download sticker:', e);
                }
            }

            // Get timestamp from quoted message
            // Note: messageTimestamp is usually Low/High Int or string in Baileys
            const qMsgTimestamp = contextInfo?.quotedMessage?.messageTimestamp;
            const timestamp = typeof qMsgTimestamp === 'number' ? qMsgTimestamp :
                (qMsgTimestamp?.low || Math.floor(Date.now() / 1000));

            const date = new Date(timestamp * 1000);
            const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            // Generate unique ID dari JID untuk avoid caching
            // const uniqueId = parseInt(quotedSender.replace(/\D/g, '').slice(-8)) || Math.floor(Math.random() * 999999);
            // QuoteGenerator usually expects integer ID for user color
            const uniqueId = parseInt(quotedSender.substring(0, 8), 16) || Math.floor(Math.random() * 999999);

            console.log('[Q] Unique ID for cache:', uniqueId);

            // Generate quote image dengan ukuran lebih besar
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
                            photo: ppBuffer ? { buffer: ppBuffer } : {}
                        },
                        text: text,
                        replyMessage: {},
                        media: mediaBuffer ? { buffer: mediaBuffer } : undefined
                    }
                ]
            };

            const result = await QuoteGenerator(params);

            // Convert to proper WebP sticker format
            const stickerBuffer = await sharp(result.image)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 95 })
                .toBuffer();

            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });

            await sock.sendMessage(m.key.remoteJid, { sticker: stickerBuffer }, { quoted: m });

        } catch (error) {
            console.error('QuoteSticker error:', error);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Gagal membuat stiker!'
            });
        }
    }
}

module.exports = QuoteStickerFeature;

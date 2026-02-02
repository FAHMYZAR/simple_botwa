const { QuoteGenerator } = require('qc-generator-whatsapp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const axios = require('axios');
const AppError = require('../utils/AppError');
const storeService = require('../services/StoreServiceSingleton');

class QuoteStickerFeature {
    constructor() {
        this.name = 'q';
        this.description = '_Reply quotly pesan_';
        this.ownerOnly = false;
    }

    static unwrapQuotedMessage(message) {
        if (!message) {
            return null;
        }

        let current = message;

        while (current) {
            if (current.ephemeralMessage?.message) {
                current = current.ephemeralMessage.message;
                continue;
            }

            if (current.viewOnceMessage?.message) {
                current = current.viewOnceMessage.message;
                continue;
            }

            if (current.viewOnceMessageV2?.message) {
                current = current.viewOnceMessageV2.message;
                continue;
            }

            if (current.viewOnceMessageV2Extension?.message) {
                current = current.viewOnceMessageV2Extension.message;
                continue;
            }

            return current;
        }

        return null;
    }

    static pickMediaSource(content) {
        if (!content) {
            return null;
        }

        if (content.imageMessage) {
            return { type: 'imageMessage', payload: content.imageMessage };
        }

        if (content.stickerMessage) {
            return { type: 'stickerMessage', payload: content.stickerMessage };
        }

        return null;
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
        const quotedMessage = QuoteStickerFeature.unwrapQuotedMessage(quoted);

        if (!quotedMessage) {
            throw new AppError('Tidak bisa membaca pesan yang di-reply. Coba ulangi.');
        }

        const stanzaId = contextInfo?.stanzaId;
        let storedMessage;
        if (stanzaId) {
            const storedEntry = storeService.findMessage(parsed.remoteJid, stanzaId);
            if (storedEntry?.message) {
                storedMessage = QuoteStickerFeature.unwrapQuotedMessage(storedEntry.message);
            }
        }

        const textSource = quotedMessage || storedMessage || {};

        const name = await storeService.resolveName(quotedSender, {
            pushName: contextInfo?.pushName,
            remoteJid: parsed.remoteJid
        });

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
        } catch (error) {
            // Ignore missing or inaccessible profile pictures
        }

        // Get text
        const text = textSource.conversation ||
            textSource.extendedTextMessage?.text ||
            textSource.imageMessage?.caption ||
            textSource.stickerMessage?.caption ||
            '';

        // Get media if exists
        let mediaDataUrl = null;
        let mediaSource = QuoteStickerFeature.pickMediaSource(quotedMessage);
        if (!mediaSource && storedMessage) {
            mediaSource = QuoteStickerFeature.pickMediaSource(storedMessage);
        }

        if (mediaSource?.type === 'imageMessage') {
            const mediaBuffer = await downloadMediaMessage(
                { message: { imageMessage: mediaSource.payload } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
            const mimeType = mediaSource.payload.mimetype || 'image/jpeg';
            mediaDataUrl = `data:${mimeType};base64,${mediaBuffer.toString('base64')}`;
        } else if (mediaSource?.type === 'stickerMessage') {
            const stickerBuffer = await downloadMediaMessage(
                { message: { stickerMessage: mediaSource.payload } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
            const pngBuffer = await sharp(stickerBuffer).png().toBuffer();
            mediaDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
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
                    text,
                    replyMessage: {},
                    media: mediaDataUrl ? {
                        url: mediaDataUrl,
                    } : undefined
                }
            ]
        };

        const quoteResult = await QuoteGenerator(params);

        if (quoteResult?.error) {
            throw new AppError(`Gagal generate stiker: ${quoteResult.error}`);
        }

        if (!quoteResult || !quoteResult.image) {
            throw new AppError('Gagal generate stiker');
        }

        const sticker = await sharp(quoteResult.image)
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

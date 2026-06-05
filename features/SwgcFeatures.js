const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');
const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const crypto = require('crypto');

class GroupStatusFeature {
    constructor() {
        this.name = 'swgc';
        this.description = '_Update SwGc_';
        this.ownerOnly = false;
    }

    async execute(m, sock, parsed) {
        const jid = parsed.remoteJid;
        if (!parsed.isGroup) {
            throw new AppError('Hanya untuk grup!');
        }

        const msg = m.message;
        let mediaBuffer = null;
        let mediaType = null;
        let caption = '';

        // =========================
        // 1️⃣ MEDIA LANGSUNG (PALING AMAN)
        // =========================
        const directMedia = msg.imageMessage || msg.videoMessage;
        if (directMedia) {
            caption = directMedia.caption || '';
            mediaBuffer = await downloadMediaMessage(
                m,
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
            mediaType = msg.imageMessage ? 'image' : 'video';
        }

        // =========================
        // 2️⃣ REPLY MEDIA TANPA CAPTION
        // =========================
        else {
            const quoted = parsed.quoted;
            if (quoted) {
                // Support View Once (RVO)
                let viewOnce = quoted.viewOnceMessageV2Extension?.message ||
                               quoted.viewOnceMessageV2?.message ||
                               quoted.viewOnceMessage?.message ||
                               quoted;

                const quotedMedia = viewOnce?.imageMessage || viewOnce?.videoMessage;

                if (quotedMedia) {
                    caption = quotedMedia.caption || '';
                    mediaBuffer = await downloadMediaMessage(
                        { message: viewOnce },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    mediaType = viewOnce.imageMessage ? 'image' : 'video';
                }
            }
        }

        // =========================
        // 3️⃣ OVERRIDE CAPTION (!swgc xxx)
        // =========================
        /**
         * Logic update: 
         * Jika user mengetik text setelah command (!swgc Halo!), gunakan itu sebagai caption utamanya.
         * Jika TIDAK ada text setelah command, tetap pertahankan caption asli bawaan media.
         */
        if (parsed.argText && parsed.argText.trim().length > 0) {
            caption = parsed.argText;
        }

        // =========================
        // VALIDASI
        // =========================
        if (!mediaBuffer && !caption) {
            throw new AppError(
                `Tidak ada media.\n\n` +
                `Gunakan:\n` +
                `• kirim media + ${Formatter.code('!swgc')}\n` +
                `• reply media TANPA caption`
            );
        }

        await sock.sendMessage(jid, {
            react: { text: '⏳', key: m.key }
        });

        const content = {
            ...(mediaType === 'image' ? { image: mediaBuffer, caption: caption } : {}),
            ...(mediaType === 'video' ? { video: mediaBuffer, caption: caption } : {}),
            ...(!mediaType && caption ? { text: caption } : {}),
            backgroundColor: '#1b2226',
        };

        const inside = await generateWAMessageContent(content, {
            upload: sock.waUploadToServer,
            backgroundColor: content.backgroundColor,
        });

        const messageSecret = crypto.randomBytes(32);

        const statusMsg = generateWAMessageFromContent(
            jid,
            {
                messageContextInfo: { messageSecret },
                groupStatusMessageV2: {
                    message: {
                        ...inside,
                        messageContextInfo: { messageSecret },
                    },
                },
            },
            {}
        );

        await sock.relayMessage(jid, statusMsg.message, {
            messageId: statusMsg.key.id,
        });

        await sock.sendMessage(jid, {
            react: { text: '✅', key: m.key }
        });
    }
}

module.exports = GroupStatusFeature;

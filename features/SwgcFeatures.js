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
        if (msg.imageMessage || msg.videoMessage) {
            caption =
                msg.imageMessage?.caption ||
                msg.videoMessage?.caption ||
                '';

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

            if (quoted?.imageMessage || quoted?.videoMessage) {
                caption =
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption ||
                    '';

                mediaBuffer = await downloadMediaMessage(
                    { message: quoted },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );

                mediaType = quoted.imageMessage ? 'image' : 'video';
            }
        }

        // =========================
        // 3️⃣ OVERRIDE CAPTION (!swgc xxx)
        // =========================
        // Use parsed override if caption not set or if needed
        // Logic original: jika ada text setelah command, replace caption
        
        if (parsed.argText) {
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
            ...(caption ? { text: caption } : {}),
            ...(mediaType === 'image' ? { image: mediaBuffer } : {}),
            ...(mediaType === 'video' ? { video: mediaBuffer } : {}),
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

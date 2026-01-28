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

    async execute(m, sock) {
        try {
            const jid = m.key.remoteJid;
            if (!jid.endsWith('@g.us')) {
                return sock.sendMessage(jid, { text: '❌ Hanya untuk grup!' });
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
                const quoted =
                    msg.extendedTextMessage?.contextInfo?.quotedMessage;

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
            const body =
                msg.conversation ||
                msg.extendedTextMessage?.text ||
                '';

            if (body.startsWith('!swgc')) {
                const custom = body.replace(/^!swgc\s*/i, '');
                if (custom) caption = custom;
            }

            // =========================
            // VALIDASI
            // =========================
            if (!mediaBuffer && !caption) {
                return sock.sendMessage(jid, {
                    text:
                        '❌ Tidak ada media.\n\n' +
                        'Gunakan:\n' +
                        '• kirim media + `!swgc`\n' +
                        '• reply media TANPA caption'
                });
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

        } catch (e) {
            console.error('[SWGC]', e);
            sock.sendMessage(m.key.remoteJid, {
                text: '❌ Gagal update status grup'
            });
        }
    }
}

module.exports = GroupStatusFeature;

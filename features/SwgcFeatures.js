const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const crypto = require('crypto');

class GroupStatusFeature {
    constructor() {
        this.name = 'swgc';
        this.description = '_Update Status Grup (text / reply / media / video)_';
        this.ownerOnly = false;
    }

    async execute(m, sock) {
        try {
            const jid = m.key.remoteJid;

            if (!jid.endsWith('@g.us')) {
                await sock.sendMessage(jid, {
                    text: '❌ Fitur ini hanya bisa digunakan di grup!'
                });
                return;
            }

            const msg = m.message;
            const body =
                msg.conversation ||
                msg.extendedTextMessage?.text ||
                msg.imageMessage?.caption ||
                msg.videoMessage?.caption ||
                msg.documentMessage?.caption ||
                '';

            const context = msg.extendedTextMessage?.contextInfo;
            const quoted = context?.quotedMessage;

            let text = '';
            let mediaBuffer = null;
            let mediaType = null; // 'image' | 'video'

            // ===============================
            // 1️⃣ Ambil dari quoted message
            // ===============================
            const source = quoted || msg;

            // ---- TEXT ----
            text =
                source.conversation ||
                source.extendedTextMessage?.text ||
                source.imageMessage?.caption ||
                source.videoMessage?.caption ||
                source.documentMessage?.caption ||
                '';

            // ---- IMAGE ----
            if (source.imageMessage) {
                mediaBuffer = await downloadMediaMessage(
                    { message: { imageMessage: source.imageMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                mediaType = 'image';
            }

            // ---- VIDEO PLAYER ----
            else if (source.videoMessage) {
                mediaBuffer = await downloadMediaMessage(
                    { message: { videoMessage: source.videoMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                mediaType = 'video';
            }

            // ---- DOCUMENT VIDEO ----
            else if (source.documentMessage) {
                const mimetype = source.documentMessage.mimetype || '';
                if (mimetype.startsWith('video')) {
                    mediaBuffer = await downloadMediaMessage(
                        { message: { documentMessage: source.documentMessage } },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    mediaType = 'video'; // ⚠️ convert document → video
                }
            }

            // ===============================
            // 2️⃣ Parse teks dari command (.swgc ...)
            // ===============================
            if (body) {
                const parts = body.trim().split(/\s+/);
                if (parts[0].toLowerCase().includes('swgc')) {
                    parts.shift();
                    if (parts.length) {
                        text = parts.join(' ');
                    }
                }
            }

            // ===============================
            // Validasi akhir
            // ===============================
            if (!text && !mediaBuffer) {
                await sock.sendMessage(jid, {
                    text:
                        '❌ Tidak ada konten.\n\n' +
                        'Gunakan:\n' +
                        '• `.swgc teks`\n' +
                        '• reply pesan / media\n' +
                        '• kirim video + `.swgc`'
                });
                return;
            }

            await sock.sendMessage(jid, {
                react: { text: '⏳', key: m.key }
            });

            console.log('[SWGC]', {
                group: jid,
                text: text || '(no text)',
                mediaType: mediaType || 'none',
            });

            // ===============================
            // Build WA Status Content
            // ===============================
            const content = {
                ...(text ? { text } : {}),
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

        } catch (error) {
            console.error('[SWGC] Error:', error);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Gagal mengupdate status grup!'
            });
        }
    }
}

module.exports = GroupStatusFeature;
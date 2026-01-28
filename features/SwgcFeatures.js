const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const crypto = require('crypto');

class GroupStatusFeature {
    constructor() {
        this.name = 'swgc';
        this.description = '_Update Status Grup (media & caption fleksibel)_';
        this.ownerOnly = false;
    }

    async execute(m, sock) {
        try {
            const jid = m.key.remoteJid;
            if (!jid.endsWith('@g.us')) {
                await sock.sendMessage(jid, { text: '❌ Fitur ini hanya untuk grup!' });
                return;
            }

            const msg = m.message;
            const body =
                msg.conversation ||
                msg.extendedTextMessage?.text ||
                msg.imageMessage?.caption ||
                msg.videoMessage?.caption ||
                '';

            const context = msg.extendedTextMessage?.contextInfo;
            const quoted = context?.quotedMessage;

            let mediaBuffer = null;
            let mediaType = null; // image | video
            let captionFromMedia = '';
            let overrideCaption = '';

            // ===============================
            // 1️⃣ Parse caption override dari !swgc
            // ===============================
            if (body) {
                const parts = body.trim().split(/\s+/);
                if (parts[0].toLowerCase().includes('swgc')) {
                    parts.shift();
                    overrideCaption = parts.join(' ').trim(); // BISA KOSONG
                }
            }

            // ===============================
            // 2️⃣ PRIORITAS: reply media
            // ===============================
            const source = quoted || msg;

            // ---- IMAGE ----
            if (source.imageMessage) {
                captionFromMedia = source.imageMessage.caption || '';
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
                captionFromMedia = source.videoMessage.caption || '';
                mediaBuffer = await downloadMediaMessage(
                    { message: { videoMessage: source.videoMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                mediaType = 'video';
            }

            // ---- DOCUMENT VIDEO ----
            else if (source.documentMessage?.mimetype?.startsWith('video')) {
                captionFromMedia = source.documentMessage.caption || '';
                mediaBuffer = await downloadMediaMessage(
                    { message: { documentMessage: source.documentMessage } },
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                );
                mediaType = 'video';
            }

            // ===============================
            // 3️⃣ Tentukan caption final
            // ===============================
            let finalText = '';

            if (overrideCaption) {
                // User eksplisit override
                finalText = overrideCaption;
            } else if (captionFromMedia) {
                // Pakai caption lama
                finalText = captionFromMedia;
            } else if (!mediaBuffer && overrideCaption) {
                finalText = overrideCaption;
            }

            // ===============================
            // 4️⃣ Kasus tanpa media sama sekali
            // ===============================
            if (!mediaBuffer && !finalText) {
                await sock.sendMessage(jid, {
                    text:
                        '❌ Tidak ada konten.\n\n' +
                        'Gunakan:\n' +
                        '• `!swgc teks`\n' +
                        '• reply media\n' +
                        '• reply media + `!swgc caption baru`'
                });
                return;
            }

            await sock.sendMessage(jid, {
                react: { text: '⏳', key: m.key }
            });

            console.log('[SWGC]', {
                group: jid,
                media: mediaType || 'none',
                caption: finalText || '(none)',
            });

            // ===============================
            // 5️⃣ Build status content
            // ===============================
            const content = {
                ...(finalText ? { text: finalText } : {}),
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

        } catch (err) {
            console.error('[SWGC] Error:', err);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Gagal mengupdate status grup!'
            });
        }
    }
}

module.exports = GroupStatusFeature;

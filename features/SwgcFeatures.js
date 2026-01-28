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
                await sock.sendMessage(jid, { text: '❌ Fitur ini hanya untuk grup!' });
                return;
            }

            const msg = m.message;
            const ext = msg.extendedTextMessage;
            const context = ext?.contextInfo;
            const quoted = context?.quotedMessage;

            const stanzaId = context?.stanzaId;

            let mediaBuffer = null;
            let mediaType = null; // image | video
            let captionFromMedia = '';
            let overrideCaption = '';

            // ===============================
            // 1️⃣ Parse caption override (!swgc xxx)
            // ===============================
            const body =
                msg.conversation ||
                ext?.text ||
                msg.imageMessage?.caption ||
                msg.videoMessage?.caption ||
                '';

            if (body) {
                const parts = body.trim().split(/\s+/);
                if (parts[0].toLowerCase().includes('swgc')) {
                    parts.shift();
                    overrideCaption = parts.join(' ').trim();
                }
            }

            // ===============================
            // 2️⃣ PRIORITAS: REPLY MEDIA
            // ===============================
            if (quoted && stanzaId) {
                // IMAGE
                if (quoted.imageMessage) {
                    captionFromMedia = quoted.imageMessage.caption || '';
                    mediaBuffer = await downloadMediaMessage(
                        {
                            message: quoted,
                            key: {
                                remoteJid: jid,
                                id: stanzaId,
                                fromMe: false,
                            },
                        },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    mediaType = 'image';
                }

                // VIDEO PLAYER
                else if (quoted.videoMessage) {
                    captionFromMedia = quoted.videoMessage.caption || '';
                    mediaBuffer = await downloadMediaMessage(
                        {
                            message: quoted,
                            key: {
                                remoteJid: jid,
                                id: stanzaId,
                                fromMe: false,
                            },
                        },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    mediaType = 'video';
                }

                // DOCUMENT VIDEO
                else if (quoted.documentMessage?.mimetype?.startsWith('video')) {
                    captionFromMedia = quoted.documentMessage.caption || '';
                    mediaBuffer = await downloadMediaMessage(
                        {
                            message: quoted,
                            key: {
                                remoteJid: jid,
                                id: stanzaId,
                                fromMe: false,
                            },
                        },
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    mediaType = 'video';
                }
            }

            // ===============================
            // 3️⃣ Kirim media langsung + !swgc
            // ===============================
            if (!mediaBuffer) {
                if (msg.imageMessage) {
                    captionFromMedia = msg.imageMessage.caption || '';
                    mediaBuffer = await downloadMediaMessage(
                        m,
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    mediaType = 'image';
                } else if (msg.videoMessage) {
                    captionFromMedia = msg.videoMessage.caption || '';
                    mediaBuffer = await downloadMediaMessage(
                        m,
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                    mediaType = 'video';
                }
            }

            // ===============================
            // 4️⃣ Tentukan caption FINAL
            // ===============================
            const finalCaption =
                overrideCaption ||
                captionFromMedia ||
                '';

            // ===============================
            // VALIDASI
            // ===============================
            if (!mediaBuffer && !finalCaption) {
                await sock.sendMessage(jid, {
                    text:
                        '❌ Tidak ada konten.\n\n' +
                        'Gunakan:\n' +
                        '• reply media\n' +
                        '• reply media + `!swgc caption`\n' +
                        '• kirim media + `!swgc caption`'
                });
                return;
            }

            await sock.sendMessage(jid, {
                react: { text: '⏳', key: m.key }
            });

            console.log('[SWGC]', {
                group: jid,
                media: mediaType,
                caption: finalCaption || '(none)',
            });

            // ===============================
            // BUILD STATUS
            // ===============================
            const content = {
                ...(finalCaption ? { text: finalCaption } : {}),
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
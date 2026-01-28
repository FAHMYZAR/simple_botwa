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
                await sock.sendMessage(jid, {
                    text: '❌ Fitur ini hanya bisa digunakan di grup!'
                });
                return;
            }

            // ===============================
            // Ambil message utama
            // ===============================
            const msg = m.message;
            const body =
                msg.conversation ||
                msg.extendedTextMessage?.text ||
                msg.imageMessage?.caption ||
                msg.videoMessage?.caption ||
                '';

            // ===============================
            // Ambil quoted message (jika ada)
            // ===============================
            const context = msg.extendedTextMessage?.contextInfo;
            const quoted = context?.quotedMessage;

            let text = '';
            let media = null;

            // ===============================
            // 1️⃣ Jika reply pesan
            // ===============================
            if (quoted) {
                text =
                    quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption ||
                    '';

                if (quoted.imageMessage || quoted.videoMessage) {
                    try {
                        media = await downloadMediaMessage(
                            { message: quoted },
                            'buffer',
                            {},
                            { logger: console, reuploadRequest: sock.updateMediaMessage }
                        );
                    } catch (e) {
                        console.error('[SWGC] Failed download quoted media:', e);
                    }
                }
            }

            // ===============================
            // 2️⃣ Jika kirim media + .swgc
            // ===============================
            if (!media && (msg.imageMessage || msg.videoMessage)) {
                try {
                    media = await downloadMediaMessage(
                        m,
                        'buffer',
                        {},
                        { logger: console, reuploadRequest: sock.updateMediaMessage }
                    );
                } catch (e) {
                    console.error('[SWGC] Failed download media:', e);
                }
            }

            // ===============================
            // 3️⃣ Parse teks dari command (.swgc ...)
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
            if (!text && !media) {
                await sock.sendMessage(jid, {
                    text: '❌ Tidak ada konten.\nGunakan `.swgc teks`, reply pesan, atau kirim media.'
                });
                return;
            }

            await sock.sendMessage(jid, {
                react: { text: '⏳', key: m.key }
            });

            console.log('[SWGC] Group:', jid);
            console.log('[SWGC] Text:', text || '(no text)');
            console.log('[SWGC] Media:', media ? 'YES' : 'NO');

            // ===============================
            // Build content
            // ===============================
            const content = {
                ...(text ? { text } : {}),
                ...(media ? { image: media } : {}),
                backgroundColor: '#1b2226',
            };

            const inside = await generateWAMessageContent(content, {
                upload: sock.waUploadToServer,
                backgroundColor: content.backgroundColor,
            });

            const messageSecret = crypto.randomBytes(32);

            const msgStatus = generateWAMessageFromContent(
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

            await sock.relayMessage(jid, msgStatus.message, {
                messageId: msgStatus.key.id,
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

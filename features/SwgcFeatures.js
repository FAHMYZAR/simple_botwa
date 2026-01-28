const {
    generateWAMessageContent,
    generateWAMessageFromContent,
} = require('@whiskeysockets/baileys');
const crypto = require('crypto');

class GroupStatusFeature {
    constructor() {
        this.name = 'swgc';
        this.description = '_Update status grup (Group Status V2)_';
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

            // 🔹 Ambil teks mentah pesan
            const body =
                m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                '';

            // 🔹 Parse command & args sendiri
            // contoh: ".swgc Halo grup"
            const parts = body.trim().split(/\s+/);
            parts.shift(); // buang "swgc"
            const text = parts.join(' ').trim();

            if (!text) {
                await sock.sendMessage(jid, {
                    text: '❌ Masukkan teks status grup!\nContoh: `.swgc Halo semua 👋`'
                });
                return;
            }

            await sock.sendMessage(jid, {
                react: { text: '⏳', key: m.key }
            });

            console.log('[SWGC] Group:', jid);
            console.log('[SWGC] Text:', text);

            const content = {
                text,
                backgroundColor: '#1b2226',
            };

            const inside = await generateWAMessageContent(content, {
                upload: sock.waUploadToServer,
                backgroundColor: content.backgroundColor,
            });

            const messageSecret = crypto.randomBytes(32);

            const msg = generateWAMessageFromContent(
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

            await sock.relayMessage(jid, msg.message, {
                messageId: msg.key.id,
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

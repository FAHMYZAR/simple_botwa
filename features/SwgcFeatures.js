const {
    generateWAMessageContent,
    generateWAMessageFromContent,
} = require('@whiskeysockets/baileys');
const crypto = require('crypto');

class GroupStatusFeature {
    constructor() {
        this.name = 'swgc';
        this.description = '_Update SwGc_';
        this.ownerOnly = false;
    }

    async execute(m, sock, args) {
    try {
        args = Array.isArray(args) ? args : [];

        const jid = m.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        if (!isGroup) {
            await sock.sendMessage(jid, {
                text: '❌ Fitur ini hanya bisa digunakan di grup!'
            });
            return;
        }

        if (args.length === 0) {
            await sock.sendMessage(jid, {
                text: '❌ Masukkan teks status grup!'
            });
            return;
        }

            await sock.sendMessage(jid, {
                react: { text: '⏳', key: m.key }
            });

            const text = args.join(' ');

            console.log('[SWGC] ===== DEBUG INFO =====');
            console.log('[SWGC] Group JID:', jid);
            console.log('[SWGC] Text:', text);

            const content = {
                text,
                backgroundColor: '#1b2226',
            };

            // Generate message content
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

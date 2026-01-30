const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class TagAllFeature {
    constructor() {
        this.name = 'tagall';
        this.description = '_Tag semua member grup_';
        this.ownerOnly = false;
    }

    async execute(m, sock, parsed) {
        // 1. Cek apakah ini di dalam Grup
        if (!parsed.isGroup) {
            throw new AppError('Perintah ini hanya bisa digunakan di grup!');
        }

        // 2. Ambil metadata grup & partisipan
        const groupMetadata = await sock.groupMetadata(parsed.remoteJid);
        const participants = groupMetadata.participants;
        const mentions = participants.map(p => p.id);

        // 3. Ambil argumen pesan (pesan setelah command) - Pake parsed.argText
        let text = parsed.argText;

        // 4. Cek apakah ada reply message (quoted)
        const quoted = parsed.quoted;

        if (quoted) {
            // Jika user me-reply pesan seseorang, kita ambil konten pesan yg di-reply
            const quotedText = quoted.conversation ||
                quoted.extendedTextMessage?.text ||
                quoted.imageMessage?.caption ||
                quoted.videoMessage?.caption ||
                '_Media Message_';

            // Jika user tidak menulis pesan tambahan, pakai default
            text = text || Formatter.bold('PERHATIAN!');

            let message = `${text}\n\n`;
            message += `━━━━━━━━━━━━━━━\n`;
            message += `${quotedText}\n`;
            message += `━━━━━━━━━━━━━━━\n\n`;

            message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

            await sock.sendMessage(parsed.remoteJid, {
                text: message,
                mentions: mentions
            });

        } else {
            // Jika tidak ada reply
            text = text || Formatter.bold('TAG ALL');

            let message = `${text}\n\n`;
            message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

            await sock.sendMessage(parsed.remoteJid, {
                text: message,
                mentions: mentions
            });
        }
    }
}

module.exports = TagAllFeature;

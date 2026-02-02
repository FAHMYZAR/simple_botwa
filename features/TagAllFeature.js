const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');
const Helper = require('../utils/helper');

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
        const mentions = participants.map((p) => p.id);

        // 3. Persiapkan isi pengumuman
        const reason = (parsed.argText || '').trim();
        const quoted = parsed.quoted;

        const quotedText = quoted?.conversation ||
            quoted?.extendedTextMessage?.text ||
            quoted?.extendedTextMessage?.matchedText ||
            quoted?.imageMessage?.caption ||
            quoted?.videoMessage?.caption ||
            quoted?.documentMessage?.caption ||
            quoted?.documentMessage?.fileName ||
            '';

        const headerLine = reason
            ? `${Formatter.bold('Pengumuman')}: ${reason}`
            : Formatter.bold('Pengumuman');

        const mentionLines = mentions.map((jid) => `@${jid.split('@')[0]}`).join('\n');

        const captionParts = [headerLine];

        if (quotedText) {
            captionParts.push('');
            captionParts.push(Formatter.quote(quotedText));
        }

        if (mentionLines) {
            captionParts.push('');
            captionParts.push(mentionLines);
        }

        const caption = captionParts.join('\n');

        if (quoted?.imageMessage) {
            const buffer = await Helper.downloadMedia(quoted.imageMessage, 'image');
            await sock.sendMessage(parsed.remoteJid, {
                image: buffer,
                mimetype: quoted.imageMessage.mimetype,
                caption,
                mentions
            }, { quoted: m });
            return;
        }

        if (quoted?.videoMessage) {
            const buffer = await Helper.downloadMedia(quoted.videoMessage, 'video');
            await sock.sendMessage(parsed.remoteJid, {
                video: buffer,
                mimetype: quoted.videoMessage.mimetype,
                caption,
                mentions,
                gifPlayback: quoted.videoMessage.gifPlayback || false
            }, { quoted: m });
            return;
        }

        if (quoted?.documentMessage) {
            const buffer = await Helper.downloadMedia(quoted.documentMessage, 'document');
            await sock.sendMessage(parsed.remoteJid, {
                document: buffer,
                fileName: quoted.documentMessage.fileName || 'document',
                mimetype: quoted.documentMessage.mimetype,
                caption,
                mentions
            }, { quoted: m });
            return;
        }

        await sock.sendMessage(parsed.remoteJid, {
            text: caption,
            mentions
        }, { quoted: m });
    }
}

module.exports = TagAllFeature;

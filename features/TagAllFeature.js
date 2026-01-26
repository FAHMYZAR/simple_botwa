class TagAllFeature {
    constructor() {
        this.name = 'tagall';
        this.description = '_Tag semua member grup_';
        this.ownerOnly = false;
    }

    async execute(m, sock) {
        try {
            // 1. Cek apakah ini di dalam Grup
            // m.key.remoteJid berakhir dengan '@g.us' untuk grup
            if (!m.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: '❌ Perintah ini hanya bisa digunakan di grup!'
                });
                return;
            }

            // 2. Ambil metadata grup & partisipan
            const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
            const participants = groupMetadata.participants;
            const mentions = participants.map(p => p.id);

            // 3. Ambil argumen pesan (pesan setelah command)
            const messageText = m.message.conversation || m.message.extendedTextMessage?.text || '';
            // Hapus command awal (misal '/tagall ')
            const args = messageText.trim().split(' ').slice(1);

            // Ambil teks kustom user atau default
            let text = args.join(' ');

            // 4. Cek apakah ada reply message (quoted)
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (quoted) {
                // Jika user me-reply pesan seseorang, kita ambil konten pesan yg di-reply
                const quotedText = quoted.conversation ||
                    quoted.extendedTextMessage?.text ||
                    quoted.imageMessage?.caption ||
                    quoted.videoMessage?.caption ||
                    '_Media Message_';

                // Jika user tidak menulis pesan tambahan, pakai default
                text = text || '📢 *PERHATIAN!*';

                let message = `${text}\n\n`;
                message += `━━━━━━━━━━━━━━━\n`;
                message += `${quotedText}\n`;
                message += `━━━━━━━━━━━━━━━\n\n`;

                // Tambahkan list mention (namun biasanya hidden di WhatsApp modern, 
                // tapi kita list saja supaya terlihat "Tag All" nya)
                // message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');
                // UPDATE: User meminta "style help features", biasanya bersih.
                // Tapi tagall butuh mention array di 'mentions' property.
                // Menampilkan list user di body pesan kadang bikin spam text panjang.
                // Tapi referensi user menampilkannya. Saya akan ikut referensi user.
                message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

                await sock.sendMessage(m.key.remoteJid, {
                    text: message,
                    mentions: mentions
                });

            } else {
                // Jika tidak ada reply
                text = text || '📢 *TAG ALL*';

                let message = `${text}\n\n`;
                message += mentions.map(jid => `@${jid.split('@')[0]}`).join('\n');

                await sock.sendMessage(m.key.remoteJid, {
                    text: message,
                    mentions: mentions
                });
            }

        } catch (error) {
            console.error('[TAGALL] Error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Terjadi kesalahan saat mencoba tag all.'
            });
        }
    }
}

module.exports = TagAllFeature;

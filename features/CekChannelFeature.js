const Formatter = require('../utils/Formatter');

class CekChannelFeature {
  constructor() {
    this.name = 'cekch';
    this.description = 'Cek id Ch';
    this.ownerOnly = true;
  }

  async execute(m, sock, parsed) {
    const contextInfo = parsed.contextInfo || {};
    
    // Cek apakah pesan di-reply dan pesan yang di-reply memiliki info newsletter
    const quotedNewsletterInfo = contextInfo.quotedMessage?.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo 
                              || contextInfo.quotedMessage?.imageMessage?.contextInfo?.forwardedNewsletterMessageInfo
                              || contextInfo.quotedMessage?.videoMessage?.contextInfo?.forwardedNewsletterMessageInfo;

    const currentNewsletterInfo = contextInfo.forwardedNewsletterMessageInfo;

    const newsletterInfo = quotedNewsletterInfo || currentNewsletterInfo;

    if (!newsletterInfo) {
      await sock.sendMessage(parsed.remoteJid, {
        text: '❌ Silakan forward sebuah pesan dari Saluran/Channel kamu ke sini, lalu balas pesan tersebut dengan command ini, atau kirim command ini bersamaan dengan mem-forward pesan.'
      }, { quoted: m });
      return;
    }

    const replyText = [
      Formatter.bold('📢 Info Saluran Ditemukan!'),
      `› Nama: ${newsletterInfo.newsletterName || 'Tidak diketahui'}`,
      `› JID: ${Formatter.code(newsletterInfo.newsletterJid)}`,
      `› Server ID: ${newsletterInfo.serverId || 'Tidak diketahui'}`,
      '',
      '_Salin JID di atas dan masukkan ke dalam kode botmu._'
    ].join('\n');

    await sock.sendMessage(parsed.remoteJid, { text: replyText }, { quoted: m });
  }
}

module.exports = CekChannelFeature;

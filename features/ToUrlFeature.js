const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class ToUrlFeature {
  constructor() {
    this.name = 'tourl';
    this.description = 'Mengubah media menjadi URL (Catbox)';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    try {
      const { downloadContentFromMessage } = require('@mataram/wa');
      
      let mediaMessage = null;
      let mediaType = '';

      if (m.message?.imageMessage) {
        mediaMessage = m.message.imageMessage;
        mediaType = 'image';
      } else if (m.message?.videoMessage) {
        mediaMessage = m.message.videoMessage;
        mediaType = 'video';
      } else if (parsed.quoted) {
        if (parsed.quoted.imageMessage) {
          mediaMessage = parsed.quoted.imageMessage;
          mediaType = 'image';
        } else if (parsed.quoted.videoMessage) {
          mediaMessage = parsed.quoted.videoMessage;
          mediaType = 'video';
        }
      }

      if (!mediaMessage) {
        await sock.sendMessage(parsed.remoteJid, { text: '❌ Reply atau kirim gambar/video dengan caption .tourl' }, { quoted: m });
        return;
      }

      await sock.sendMessage(parsed.remoteJid, { text: '⏳ Mengupload media...' }, { quoted: m });

      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const tempFileName = `temp_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
      const tempPath = path.join(tempDir, tempFileName);
      fs.writeFileSync(tempPath, buffer);

      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', fs.createReadStream(tempPath));

      const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders()
      });

      fs.unlinkSync(tempPath);

      if (res.data && typeof res.data === 'string' && res.data.startsWith('https://')) {
        await sock.sendMessage(parsed.remoteJid, { text: `✅ *URL:*\n${res.data}` }, { quoted: m });
      } else {
        await sock.sendMessage(parsed.remoteJid, { text: '❌ Gagal mengupload ke Catbox!' }, { quoted: m });
      }

    } catch (error) {
      console.error('ToUrl error:', error);
      await sock.sendMessage(parsed.remoteJid, { text: '❌ Terjadi kesalahan saat mengupload media!' }, { quoted: m });
    }
  }
}

module.exports = ToUrlFeature;

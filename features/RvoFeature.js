const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

class RvoFeature {
  constructor() {
    this.name = 'rvo';
    this.description = '_Ekstrak media sekali lihat_';
    this.ownerOnly = false;
  }

  async execute(m, sock) {
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg) {
        await sock.sendMessage(m.key.remoteJid, {
          text: 'Reply ke media sekali lihat!'
        });
        return;
      }

      let viewOnce = quotedMsg?.viewOnceMessageV2Extension?.message ||
        quotedMsg?.viewOnceMessageV2?.message ||
        quotedMsg?.viewOnceMessage?.message ||
        quotedMsg;

      let mediaType, mediaMessage;
      if (viewOnce?.imageMessage) {
        mediaType = 'image';
        mediaMessage = viewOnce.imageMessage;
      } else if (viewOnce?.videoMessage) {
        mediaType = 'video';
        mediaMessage = viewOnce.videoMessage;
      } else {
        await sock.sendMessage(m.key.remoteJid, {
          text: 'Media tidak didukung!'
        });
        return;
      }

      await sock.sendMessage(m.key.remoteJid, {
        text: 'Mengekstrak media...'
      });

      const buffer = await downloadMediaMessage(
        { message: { [`${mediaType}Message`]: mediaMessage } },
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      const storageDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      const ext = mediaType === 'image' ? 'jpg' : 'mp4';
      const filename = path.join(storageDir, `${Date.now()}.${ext}`);
      fs.writeFileSync(filename, buffer);

      const caption = mediaMessage.caption;
      const message = caption || '';

      await sock.sendMessage(m.key.remoteJid, {
        [mediaType]: { url: filename },
        caption: message
      });

    } catch (error) {
      await sock.sendMessage(m.key.remoteJid, {
        text: error.message
      });
    }
  }
}

module.exports = RvoFeature;
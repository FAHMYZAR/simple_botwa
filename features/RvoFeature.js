const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class RvoFeature {
  constructor() {
    this.name = 'rvo';
    this.description = '_Ekstrak media sekali lihat_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const quotedMsg = parsed.quoted;
    if (!quotedMsg) {
       throw new AppError('Reply ke media sekali lihat!');
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
       throw new AppError('Media tidak didukung!');
    }

    await sock.sendMessage(parsed.remoteJid, {
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

    await sock.sendMessage(parsed.remoteJid, {
      [mediaType]: { url: filename },
      caption: message
    });
  }
}

module.exports = RvoFeature;
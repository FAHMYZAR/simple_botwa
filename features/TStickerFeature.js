const axios = require('axios');
const sharp = require('sharp');
const config = require('../config/config');
const Helper = require('../utils/helper');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEOUT_MS = 20000;

function isUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

async function downloadTelegramStickerImage(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: DEFAULT_TIMEOUT_MS
  });
  return Buffer.from(response.data);
}

async function convertImageToSticker(buffer) {
  return sharp(buffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true })
    .toBuffer();
}

class TStickerFeature {
  constructor() {
    this.name = 'ts';
    this.description = '_Import Tele stiker_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { argText, quoted, remoteJid } = parsed;
    const telegramConfig = config.stickerService?.telegram || {};

    if (!argText && !quoted) {
      throw new AppError('Gunakan perintah pada stiker, gambar, atau sertakan tautan Telegram pack.');
    }

    await sock.sendMessage(remoteJid, { react: { text: '🧩', key: m.key } });

    try {
      if (quoted?.stickerMessage) {
        await this.handleQuotedSticker(m, sock, parsed);
        return;
      }

      if (quoted?.imageMessage) {
        await this.handleQuotedImage(m, sock, parsed);
        return;
      }

      const trimmed = (argText || '').trim();
      if (trimmed && isUrl(trimmed.split(/\s+/)[0])) {
        await this.handleTelegramPack(trimmed, m, sock, parsed, telegramConfig);
        return;
      }

      throw new AppError('Format tidak dikenal. Reply stiker/gambar atau kirim tautan Telegram pack.');
    } finally {
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }

  async handleQuotedSticker(m, sock, parsed) {
    const { quoted, remoteJid } = parsed;
    const stickerBuffer = await Helper.downloadMedia(quoted.stickerMessage, 'sticker');

    if (!stickerBuffer || !stickerBuffer.length) {
      throw new AppError('Gagal mengambil stiker yang di-reply.');
    }

    await sock.sendMessage(remoteJid, {
      sticker: stickerBuffer,
      mimetype: 'image/webp'
    }, { quoted: m });

    await sock.sendMessage(remoteJid, {
      text: Formatter.italic('Stiker dikirim ulang. Tahan stiker untuk menambah ke favorit kamu.')
    }, { quoted: m });
  }

  async handleQuotedImage(m, sock, parsed) {
    const { quoted, remoteJid } = parsed;
    const imageBuffer = await Helper.downloadMedia(quoted.imageMessage, 'image');

    if (!imageBuffer || !imageBuffer.length) {
      throw new AppError('Gagal mengambil gambar yang di-reply.');
    }

    const stickerBuffer = await convertImageToSticker(imageBuffer);

    await sock.sendMessage(remoteJid, {
      sticker: stickerBuffer,
      mimetype: 'image/webp'
    }, { quoted: m });

    await sock.sendMessage(remoteJid, {
      text: Formatter.italic('Gambar diubah menjadi stiker. Tahan stiker untuk menyimpan.')
    }, { quoted: m });
  }

  async handleTelegramPack(rawInput, m, sock, parsed, telegramConfig) {
    const { remoteJid } = parsed;

    if (!telegramConfig.apiKey) {
      throw new AppError('Telegram sticker API key belum diset di konfigurasi environment.');
    }

    if (!telegramConfig.endpoint) {
      throw new AppError('Telegram sticker endpoint belum diset di konfigurasi environment.');
    }

    const tokens = rawInput.split(/\s+/);
    const link = tokens.shift();
    const flags = tokens;

    if (!isUrl(link)) {
      throw new AppError('Tautan Telegram tidak valid.');
    }

    const limitFlag = flags.find((flag) => flag.startsWith('--limit='));
    const requestedLimit = limitFlag ? Number.parseInt(limitFlag.split('=')[1], 10) : 0;

    const response = await axios.get(telegramConfig.endpoint, {
      params: {
        link,
        apikey: telegramConfig.apiKey
      },
      timeout: DEFAULT_TIMEOUT_MS
    });

    const data = response.data || {};
    const isSuccess = data.success === true || data.status === true || data.status === 200;

    if (!isSuccess) {
      const reason = data.message || data.result || 'Gagal mengambil pack Telegram.';
      throw new Error(reason);
    }

    const result = data.result;
    const stickers = Array.isArray(result?.stickers) ? result.stickers : [];

    if (!stickers.length) {
      throw new AppError('Pack Telegram tidak memiliki stiker statis yang bisa diambil.');
    }

    const title = result.title || result.name || 'Telegram Sticker Pack';
    const total = stickers.length;

    let sendCount = total;
    if (requestedLimit && !Number.isNaN(requestedLimit)) {
      sendCount = requestedLimit;
    }

    sendCount = Math.max(1, Math.min(sendCount, total));

    await sock.sendMessage(remoteJid, {
      text: [
        Formatter.bold(title),
        `Total stiker: ${total}`,
        `Mengirim ${sendCount} stiker statis (animated dilewati).`,
        Formatter.italic('Tahan stiker di WhatsApp untuk menambahkan ke favorit / pack kamu.')
      ].join('\n')
    }, { quoted: m });

    let delivered = 0;
    let skippedAnimated = 0;

    for (const stickerInfo of stickers) {
      if (delivered >= sendCount) {
        break;
      }

      if (stickerInfo.is_animated) {
        skippedAnimated += 1;
        continue;
      }

      if (!stickerInfo.image_url) {
        continue;
      }

      try {
        const stickerBuffer = await downloadTelegramStickerImage(stickerInfo.image_url);
        await sock.sendMessage(remoteJid, {
          sticker: stickerBuffer,
          mimetype: 'image/webp'
        }, { quoted: m });
        delivered += 1;
      } catch (error) {
        console.error('[TSTICKER] Failed to send Telegram sticker:', error.message);
      }
    }

    if (delivered === 0) {
      throw new AppError('Tidak ada stiker Telegram yang bisa dikirim (semua mungkin animated).');
    }

    if (skippedAnimated > 0) {
      await sock.sendMessage(remoteJid, {
        text: Formatter.italic(`${skippedAnimated} stiker dilewati karena animated.`)
      }, { quoted: m });
    }
  }
}

module.exports = TStickerFeature;

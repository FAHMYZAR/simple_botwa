const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEOUT_MS = 60000;
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';
const IMGBB_API_KEY = '2e818dd0cf97e5a2f6b08f4153d51570';

/**
 * Extract image message from various message types including view once
 */
function extractImageMessage(message, quoted) {
  // Check quoted message first
  if (quoted) {
    // View once variants
    const viewOnce =
      quoted.viewOnceMessageV2Extension?.message ||
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessage?.message ||
      quoted;

    if (viewOnce?.imageMessage) {
      return viewOnce.imageMessage;
    }

    // Regular image
    if (quoted.imageMessage) {
      return quoted.imageMessage;
    }
  }

  // Check main message
  if (message?.imageMessage) {
    return message.imageMessage;
  }

  // View once in main message
  const viewOnceMain =
    message?.viewOnceMessageV2Extension?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.viewOnceMessage?.message;

  if (viewOnceMain?.imageMessage) {
    return viewOnceMain.imageMessage;
  }

  return null;
}

/**
 * Upload image to ImgBB and get public URL
 */
async function uploadToImgBB(buffer) {
  const base64Image = buffer.toString('base64');

  const formData = new URLSearchParams();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', base64Image);

  const response = await axios.post(IMGBB_UPLOAD_URL, formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: DEFAULT_TIMEOUT_MS
  });

  if (!response.data?.success) {
    throw new Error('Gagal upload gambar ke hosting.');
  }

  return response.data.data.url;
}

/**
 * Call Ferdev Remini API to upscale image
 */
async function upscaleWithRemini(imageUrl, apiKey) {
  const response = await axios.get(`${config.ferdev.baseUrl}/tools/remini`, {
    params: {
      link: imageUrl,
      apikey: apiKey
    },
    timeout: DEFAULT_TIMEOUT_MS
  });

  const data = response.data || {};
  const isSuccess = data.success === true || data.status === true || data.status === 200;

  if (!isSuccess) {
    throw new Error(data.message || 'Gagal memproses gambar dengan Remini.');
  }

  return data.data || data.result;
}

/**
 * Download image from URL
 */
async function downloadImage(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: DEFAULT_TIMEOUT_MS
  });
  return Buffer.from(response.data);
}

class ReminiFeature {
  constructor() {
    this.name = 'remini';
    this.description = '_Upscale gambar (Remini AI)_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { remoteJid, quoted } = parsed;
    const ferdevConfig = config.ferdev || {};

    if (!ferdevConfig.apiKey) {
      throw new AppError('Ferdev API key belum diset di konfigurasi environment (FERDEV_API_KEY).');
    }

    // Extract image from message or quoted
    const imageMessage = extractImageMessage(m.message, quoted);

    if (!imageMessage) {
      throw new AppError(
        `Reply gambar atau media sekali lihat dengan ${Formatter.code('!remini')} untuk upscale kualitas.`
      );
    }

    await sock.sendMessage(remoteJid, { react: { text: '✨', key: m.key } });

    try {
      // Step 1: Download image
      await sock.sendMessage(remoteJid, {
        text: Formatter.italic('📥 Mengunduh gambar...')
      });

      const buffer = await downloadMediaMessage(
        { message: { imageMessage } },
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer || !buffer.length) {
        throw new AppError('Gagal mengunduh gambar.');
      }

      // Step 2: Upload to ImgBB
      await sock.sendMessage(remoteJid, {
        text: Formatter.italic('☁️ Mengupload gambar...')
      });

      const publicUrl = await uploadToImgBB(buffer);

      // Step 3: Process with Remini
      await sock.sendMessage(remoteJid, {
        text: Formatter.italic('✨ Memproses dengan Remini AI...')
      });

      const hdImageUrl = await upscaleWithRemini(publicUrl, ferdevConfig.apiKey);

      if (!hdImageUrl) {
        throw new AppError('Tidak ada hasil dari Remini.');
      }

      // Step 4: Download HD result
      const hdBuffer = await downloadImage(hdImageUrl);

      // Step 5: Send HD image
      await sock.sendMessage(remoteJid, {
        image: hdBuffer,
        caption: `${Formatter.bold('✨ HD Upscale Complete')}\n\n${Formatter.italic('Powered by Remini (Ferdev API)')}`
      });

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('[REMINI FEATURE FAILURE]', error);
      throw new AppError(`Gagal upscale gambar: ${errorMsg}`);
    } finally {
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }
}

module.exports = ReminiFeature;

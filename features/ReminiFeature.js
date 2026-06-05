const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEOUT_MS = 60000;
const CATBOX_API_URL = 'https://catbox.moe/user/api.php';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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
 * Upload image to Catbox.moe and get public URL
 */
async function uploadToCatbox(buffer) {
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempPath = path.join(tempDir, `remini_${Date.now()}.jpg`);
  fs.writeFileSync(tempPath, buffer);

  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fs.createReadStream(tempPath));

    const response = await axios.post(CATBOX_API_URL, form, {
      headers: form.getHeaders(),
      timeout: DEFAULT_TIMEOUT_MS
    });

    const data = response.data;
    if (!data || typeof data !== 'string' || !data.startsWith('https://')) {
      throw new Error('Invalid response from Catbox');
    }

    return data;
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
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
    this.description = '_HD Image_';
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

      // Check file size
      if (buffer.length > MAX_SIZE) {
        throw new AppError('Gambar terlalu besar! Maksimal 10MB.');
      }

      // Step 2: Upload to Catbox
      await sock.sendMessage(remoteJid, {
        text: Formatter.italic('☁️ Mengupload gambar...')
      });

      const publicUrl = await uploadToCatbox(buffer);

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

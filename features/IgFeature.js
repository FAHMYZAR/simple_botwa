const axios = require('axios');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Validate Instagram URL
 */
function isInstagramUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('instagram.com');
  } catch {
    return false;
  }
}

/**
 * Download media from URL
 */
async function downloadMedia(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  return Buffer.from(response.data);
}

/**
 * Detect media type from URL or content-type
 */
function detectMediaType(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('video')) {
    return 'video';
  }
  return 'image';
}

class IgFeature {
  constructor() {
    this.name = 'ig';
    this.description = '_Download media Instagram_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { argText, remoteJid } = parsed;
    const ferdevConfig = config.ferdev || {};

    if (!ferdevConfig.apiKey) {
      throw new AppError('Ferdev API key belum diset di konfigurasi environment (FERDEV_API_KEY).');
    }

    const link = (argText || '').trim();

    if (!link) {
      throw new AppError(
        `Masukkan link Instagram!\nContoh: ${Formatter.code('!ig https://instagram.com/reel/xxx')}`
      );
    }

    if (!isInstagramUrl(link)) {
      throw new AppError('Link tidak valid! Pastikan link dari Instagram.');
    }

    await sock.sendMessage(remoteJid, { react: { text: '📸', key: m.key } });

    try {
      await sock.sendMessage(remoteJid, {
        text: Formatter.italic('🔍 Mengambil media dari Instagram...')
      });

      const response = await axios.get(`${ferdevConfig.baseUrl}/downloader/instagram`, {
        params: {
          link: link,
          apikey: ferdevConfig.apiKey
        },
        timeout: DEFAULT_TIMEOUT_MS
      });

      const data = response.data || {};
      const isSuccess = data.success === true || data.status === true || data.status === 200;

      if (!isSuccess) {
        throw new Error(data.message || 'Gagal mengambil media Instagram.');
      }

      const result = data.data;

      if (!result) {
        throw new AppError('Data tidak tersedia dari Instagram.');
      }

      // Handle different response types
      if (result.type === 'single' && result.dlink) {
        // Single media
        await this.sendMedia(sock, remoteJid, result.dlink);
      } else if (result.type === 'carousel' && Array.isArray(result.media)) {
        // Multiple media (carousel)
        await sock.sendMessage(remoteJid, {
          text: Formatter.italic(`📦 Mengunduh ${result.media.length} media...`)
        });

        for (const mediaItem of result.media) {
          const mediaUrl = mediaItem.url || mediaItem.dlink || mediaItem;
          if (typeof mediaUrl === 'string') {
            await this.sendMedia(sock, remoteJid, mediaUrl);
          }
        }
      } else if (result.dlink) {
        // Fallback to dlink
        await this.sendMedia(sock, remoteJid, result.dlink);
      } else if (result.url) {
        // Fallback to url
        await this.sendMedia(sock, remoteJid, result.url);
      } else {
        throw new AppError('Format response tidak dikenal.');
      }

      await sock.sendMessage(remoteJid, {
        text: `${Formatter.bold('✅ Download selesai!')}\n\n${Formatter.italic('Powered by Ferdev API')}`
      });

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('[IG FEATURE FAILURE]', error);
      throw new AppError(`Gagal download Instagram: ${errorMsg}`);
    } finally {
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }

  async sendMedia(sock, remoteJid, url) {
    try {
      const buffer = await downloadMedia(url);
      const mediaType = detectMediaType(url);

      if (mediaType === 'video') {
        await sock.sendMessage(remoteJid, {
          video: buffer,
          mimetype: 'video/mp4'
        });
      } else {
        await sock.sendMessage(remoteJid, {
          image: buffer,
          mimetype: 'image/jpeg'
        });
      }
    } catch (err) {
      console.error('[IG] Failed to send media:', err.message);
    }
  }
}

module.exports = IgFeature;

const axios = require('axios');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEOUT_MS = 15000;

class GempaFeature {
  constructor() {
    this.name = 'gempa';
    this.description = '_Info gempa terbaru BMKG_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { remoteJid } = parsed;
    const ferdevConfig = config.ferdev || {};

    if (!ferdevConfig.apiKey) {
      throw new AppError('Ferdev API key belum diset di konfigurasi environment (FERDEV_API_KEY).');
    }

    await sock.sendMessage(remoteJid, { react: { text: '🌍', key: m.key } });

    try {
      const response = await axios.get(`${ferdevConfig.baseUrl}/search/gempa`, {
        params: {
          apikey: ferdevConfig.apiKey
        },
        timeout: DEFAULT_TIMEOUT_MS
      });

      const data = response.data || {};
      const isSuccess = data.success === true || data.status === true || data.status === 200;

      if (!isSuccess) {
        throw new Error(data.message || 'Gagal mengambil data gempa.');
      }

      const gempa = data.data;

      if (!gempa) {
        throw new AppError('Data gempa tidak tersedia.');
      }

      // Format message
      const message = [
        Formatter.bold('🌍 INFO GEMPA TERBARU - BMKG'),
        '',
        `${Formatter.bold('📅 Waktu:')} ${gempa.waktu}`,
        `${Formatter.bold('📍 Wilayah:')} ${gempa.wilayah}`,
        '',
        `${Formatter.bold('📊 Magnitudo:')} ${gempa.magnitudo} SR`,
        `${Formatter.bold('📏 Kedalaman:')} ${gempa.kedalaman}`,
        `${Formatter.bold('🌐 Koordinat:')} ${gempa.lintang}, ${gempa.bujur}`,
        '',
        Formatter.italic('Data dari BMKG via Ferdev API')
      ].join('\n');

      // Send with map image if available
      if (gempa.map) {
        try {
          const mapResponse = await axios.get(gempa.map, {
            responseType: 'arraybuffer',
            timeout: DEFAULT_TIMEOUT_MS
          });
          const mapBuffer = Buffer.from(mapResponse.data);

          await sock.sendMessage(remoteJid, {
            image: mapBuffer,
            caption: message
          });
        } catch {
          // If map download fails, send text only
          await sock.sendMessage(remoteJid, { text: message }, { quoted: m });
        }
      } else {
        await sock.sendMessage(remoteJid, { text: message }, { quoted: m });
      }

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('[GEMPA FEATURE FAILURE]', error);
      throw new AppError(`Gagal mengambil info gempa: ${errorMsg}`);
    } finally {
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }
}

module.exports = GempaFeature;

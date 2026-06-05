const axios = require('axios');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEOUT_MS = 15000;

class CuacaFeature {
  constructor() {
    this.name = 'cuaca';
    this.description = '_Info cuaca berdasarkan kota_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { argText, remoteJid } = parsed;
    const ferdevConfig = config.ferdev || {};

    if (!ferdevConfig.apiKey) {
      throw new AppError('Ferdev API key belum diset di konfigurasi environment (FERDEV_API_KEY).');
    }

    const kota = (argText || '').trim();

    if (!kota) {
      throw new AppError(
        `Masukkan nama kota!\nContoh: ${Formatter.code('!cuaca Jakarta')}`
      );
    }

    await sock.sendMessage(remoteJid, { react: { text: '🌤️', key: m.key } });

    try {
      const response = await axios.get(`${ferdevConfig.baseUrl}/search/cuaca`, {
        params: {
          kota: kota,
          apikey: ferdevConfig.apiKey
        },
        timeout: DEFAULT_TIMEOUT_MS
      });

      const data = response.data || {};
      const isSuccess = data.success === true || data.status === true || data.status === 200;

      if (!isSuccess) {
        throw new Error(data.message || 'Gagal mengambil data cuaca.');
      }

      const cuaca = data.data;

      if (!cuaca) {
        throw new AppError('Data cuaca tidak tersedia.');
      }

      // Get weather emoji based on condition
      const weatherEmoji = this.getWeatherEmoji(cuaca.kondisi);

      // Format message
      const message = [
        `${Formatter.bold(`${weatherEmoji} CUACA ${cuaca.kota?.toUpperCase() || kota.toUpperCase()}`)}`,
        '',
        `${Formatter.bold('🌡️ Suhu:')} ${cuaca.suhu}`,
        `${Formatter.bold('☁️ Kondisi:')} ${cuaca.kondisi}`,
        `${Formatter.bold('💧 Kelembapan:')} ${cuaca.kelembapan}`,
        `${Formatter.bold('💨 Angin:')} ${cuaca.angin}`,
        `${Formatter.bold('🌧️ Curah Hujan:')} ${cuaca.curah_hujan}`,
        `${Formatter.bold('☁️ Tutupan Awan:')} ${cuaca.tutupan_awan}`,
        `${Formatter.bold('👁️ Visibilitas:')} ${cuaca.visibilitas}`,
        '',
        `🌅 ${cuaca.terbit}`,
        `🌇 ${cuaca.terbenam}`,
        '',
        Formatter.italic('Powered by Ferdev API')
      ].join('\n');

      await sock.sendMessage(remoteJid, { text: message }, { quoted: m });

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('[CUACA FEATURE FAILURE]', error);
      throw new AppError(`Gagal mengambil info cuaca: ${errorMsg}`);
    } finally {
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }

  getWeatherEmoji(kondisi) {
    if (!kondisi) return '🌤️';
    
    const lower = kondisi.toLowerCase();
    
    if (lower.includes('cerah')) return '☀️';
    if (lower.includes('berawan') || lower.includes('mendung')) return '☁️';
    if (lower.includes('hujan lebat') || lower.includes('badai')) return '⛈️';
    if (lower.includes('hujan')) return '🌧️';
    if (lower.includes('gerimis')) return '🌦️';
    if (lower.includes('kabut') || lower.includes('berkabut')) return '🌫️';
    if (lower.includes('petir')) return '⚡';
    if (lower.includes('salju')) return '❄️';
    
    return '🌤️';
  }
}

module.exports = CuacaFeature;

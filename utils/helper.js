const fs = require('fs');
const path = require('path');
const os = require('os');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

class Helper {
  static async downloadMedia(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  }

  static loadFeatures() {
    const features = new Map();
    const featuresDir = path.join(__dirname, '../features');

    if (!fs.existsSync(featuresDir)) return features;

    const files = fs.readdirSync(featuresDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        try {
          const FeatureClass = require(path.join(featuresDir, file));
          const feature = new FeatureClass();
          features.set(feature.name, feature);
        } catch (error) {
          console.error(`Failed to load ${file}:`, error.message);
        }
      }
    }
    return features;
  }

  static getSystemInfo() {
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      memory: {
        total: totalMem + ' GB',
        used: usedMem + ' GB',
        free: freeMem + ' GB'
      },
      cpu: os.cpus()[0].model
    };
  }

  static formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  static cleanTempFolder(folderPath = path.join(__dirname, '../temp'), maxAgeMs = 5 * 60 * 1000) {
    try {
      if (!fs.existsSync(folderPath)) return;

      const files = fs.readdirSync(folderPath);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            console.log(`[CLEANUP] Deleted old temp file: ${file}`);
          }
        } catch (err) {
          console.error(`[CLEANUP] Failed to process ${file}:`, err.message);
        }
      }
    } catch (error) {
      console.error('[CLEANUP] Error cleaning temp folder:', error.message);
    }
  }
}

module.exports = Helper;
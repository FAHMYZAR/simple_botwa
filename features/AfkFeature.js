const AfkService = require('../services/AfkService');
const Formatter = require('../utils/Formatter');

class AfkFeature {
  constructor() {
    this.name = 'afk';
    this.description = '_Set bot status AFK_';
    this.ownerOnly = true; // Only owner can set bot AFK
    this.afkService = new AfkService();
  }

  async execute(m, sock, parsed) {
    const reason = parsed.argText.trim() || 'Sedang AFK';
    
    // Set AFK
    this.afkService.setAfk(reason);
    
    // Send confirmation
    const message = [
      Formatter.bold('fahmy mulai tidak aktif (AFK)'),
      `Alasan: ${reason}`,
      '',
      Formatter.italic('Kirim &stop untuk mematikan status AFK.')
    ].join('\n');
    
    await sock.sendMessage(
      parsed.remoteJid,
      { text: message },
      { quoted: m }
    );
  }
}

module.exports = AfkFeature;

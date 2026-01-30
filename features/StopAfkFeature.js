const AfkService = require('../services/AfkService');
const Formatter = require('../utils/Formatter');

class StopAfkFeature {
  constructor() {
    this.name = 'stop';
    this.description = '_Nonaktifkan status AFK bot_';
    this.ownerOnly = true; // Only owner can stop bot AFK
    this.afkService = new AfkService();
  }

  async execute(m, sock, parsed) {
    // Check if bot is currently AFK
    if (!this.afkService.isAfkActive()) {
      const message = Formatter.italic('❌ Bot tidak sedang AFK.');
      await sock.sendMessage(
        parsed.remoteJid,
        { text: message },
        { quoted: m }
      );
      return;
    }

    // Get AFK info before clearing
    const afkInfo = this.afkService.getAfkInfo();
    
    // Clear AFK
    this.afkService.clearAfk();
    
    // Send statistics
    const message = [
      Formatter.bold('fahmy kembali online'),
      '',
      'Statistik AFK:',
      `├ Alasan: ${afkInfo.reason}`,
      `└ Durasi: ${afkInfo.duration}`,
    ].join('\n');
    
    await sock.sendMessage(
      parsed.remoteJid,
      { text: message },
      { quoted: m }
    );
  }
}

module.exports = StopAfkFeature;

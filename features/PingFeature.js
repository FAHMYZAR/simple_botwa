class PingFeature {
  constructor() {
    this.name = 'ping';
    this.description = '_Cek ping bot_';
    this.ownerOnly = false;
  }

  async execute(m, sock) {
    try {
      const start = Date.now();

      await sock.sendMessage(m.key.remoteJid, {
        text: 'Menghitung...'
      });

      const pingTime = Date.now() - start;

      // Delay kecil biar WA server aman
      await new Promise(r => setTimeout(r, 500));

      await sock.sendMessage(m.key.remoteJid, {
        text: `${pingTime}ms`
      });

    } catch (error) {
      console.error('[PING ERROR]', error.message);
    }
  }
}

module.exports = PingFeature;

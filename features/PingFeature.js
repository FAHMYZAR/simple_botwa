class PingFeature {
  constructor() {
    this.name = 'ping';
    this.description = '_Respon time bot_';
    this.ownerOnly = false;
  }

  async execute(m, sock) {
    try {
      const start = Date.now();

      // Simulasikan workload minimal (realistic)
      await Promise.resolve();

      const responseTime = Date.now() - start;

      await sock.sendMessage(
        m.key.remoteJid,
        {
          text: `⚡ Respon bot: ${responseTime} ms`
        },
        { quoted: m }
      );

    } catch (error) {
      console.error('[PING] Error:', error.message);
    }
  }
}

module.exports = PingFeature;

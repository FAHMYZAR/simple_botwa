class PingFeature {
  constructor() {
    this.name = 'ping';
    this.description = '_Cek respon bot_';
    this.ownerOnly = false;
  }

  async execute(m, sock) {
    try {
      const start = Date.now();

      const ping = Date.now() - start;

      await sock.sendMessage(
        m.key.remoteJid,
        { text: `${ping}ms` },
        { quoted: m }
      );

    } catch (error) {
      console.error('[PING] Error:', error.message);
    }
  }
}

module.exports = PingFeature;

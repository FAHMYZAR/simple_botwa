class PingFeature {
  constructor() {
    this.name = 'ping';
    this.description = '_Cek ping bot_';
    this.ownerOnly = false;
  }

  async execute(m, sock) {
    try {
      const start = Date.now();
      const msg = await sock.sendMessage(m.key.remoteJid, {
        text: 'Menghitung...'
      });
      const end = Date.now();

      const pingTime = end - start;

      await sock.sendMessage(m.key.remoteJid, {
        text: `${pingTime}ms`,
        edit: msg.key
      });

    } catch (error) {
      await sock.sendMessage(m.key.remoteJid, {
        text: `*ERROR*\n\n> Pesan : ${error.message}`
      });
    }
  }
}

module.exports = PingFeature;
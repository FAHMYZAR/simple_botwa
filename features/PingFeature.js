class PingFeature {
  constructor() {
    this.name = 'ping';
    this.description = '_Respon time bot_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const start = process.hrtime.bigint();

    // workload mikro (realistis)
    await Promise.resolve();

    const end = process.hrtime.bigint();

    // nanosecond → millisecond (float)
    const responseMs = Number(end - start) / 1_000_000;

    await sock.sendMessage(
      parsed.remoteJid,
      {
        text: `Pong: ${responseMs.toFixed(3)} ms`
      },
      { quoted: m }
    );
  }
}

module.exports = PingFeature;

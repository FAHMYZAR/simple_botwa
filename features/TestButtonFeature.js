class TestFeature {
  constructor() {
    this.name = 'test';
    this.description = 'Tes kosong';
    this.ownerOnly = true;
    this.hidden = true;
  }

  async execute(m, sock, parsed) {
    await sock.sendMessage(parsed.remoteJid, {
      text: 'Tes kosong.'
    }, { quoted: m });
  }
}

module.exports = TestFeature;

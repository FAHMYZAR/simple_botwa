class TestFeature {
  constructor() {
    this.name = 'test';
    this.description = 'Dump info sender';
    this.ownerOnly = true;
    this.hidden = true;
  }

  async execute(m, sock, parsed) {
    const fs = require('fs');
    const path = require('path');
    const config = require('../config/config');

    const dump = {
      messageKey: m.key,
      parsedSender: parsed.sender,
      quotedSender: parsed.quotedSender,
      contextInfo: parsed.contextInfo,
      pushName: parsed.pushName,
      ownerNumber: config.ownerNumber,
      ownerJids: config.ownerJids
    };

    console.log('[TEST DUMP]', JSON.stringify(dump, null, 2));

    await sock.sendMessage(parsed.remoteJid, {
      text: `DUMP LOGGED TO CONSOLE:\n\nSender: ${parsed.sender}\nParticipant: ${m.key.participant}\nJID: ${m.key.remoteJid}\nFromMe: ${m.key.fromMe}`
    }, { quoted: m });
  }
}

module.exports = TestFeature;

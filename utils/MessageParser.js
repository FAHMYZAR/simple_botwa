const config = require('../config/config');

class MessageParser {
  static parse(m, sock) {
    // Handle viewOnceMessage wrapper which often wraps buttons response
    const rawMsg = m.message?.viewOnceMessage?.message || m.message?.viewOnceMessageV2?.message || m.message;
    const messageType = Object.keys(rawMsg)[0];
    const content = rawMsg[messageType];
    
    // 1. Extract Body (Raw Text)
    // Handle conversation, extendedText, image caption, dll.
    let body = '';
    if (messageType === 'conversation') {
      body = content;
    } else if (messageType === 'extendedTextMessage') {
      body = content.text;
    } else if (messageType === 'imageMessage' || messageType === 'videoMessage') {
      body = content.caption || '';
    } else if (messageType === 'documentMessage') {
      body = content.caption || '';
    } else if (messageType === 'interactiveResponseMessage') {
      try {
        const responseJSON = JSON.parse(content.nativeFlowResponseMessage?.paramsJson || '{}');
        body = responseJSON.id || '';
      } catch (e) {
        body = '';
      }
    } else if (messageType === 'buttonsResponseMessage') {
      body = content.selectedButtonId || '';
    } else if (messageType === 'templateButtonReplyMessage') {
      body = content.selectedId || '';
    }

    body = body || ''; // ensure string

    // 2. Extract Quoted Message (Context)
    const contextInfo = content?.contextInfo || null;
    const quoted = contextInfo?.quotedMessage || null;
    const quotedSender = contextInfo?.participant || null;

    // 3. Sender Info
    const sender = m.key.participant || m.key.remoteJid;
    const isGroup = m.key.remoteJid.endsWith('@g.us');
    const pushName = m.pushName || 'Unknown';

    // 4. Command Parsing
    // Dynamic prefix from config
    const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ownerPrefix = escapeRegex(config.ownerPrefix);
    const userPrefix = escapeRegex(config.userPrefix);
    
    const prefixRegex = new RegExp(`^(${ownerPrefix}|${userPrefix})`);
    
    const isCmd = prefixRegex.test(body);
    const prefix = isCmd ? body.match(prefixRegex)[0] : '';
    
    const trimmedBody = body.trim();
    // Split by newline or space to get the first word
    const [commandWord, ...args] = trimmedBody.split(/\s+/);
    
    const command = isCmd ? commandWord.slice(prefix.length).toLowerCase() : commandWord.toLowerCase();
    const argText = args.join(' ');

    return {
      type: messageType,
      body: trimmedBody,
      prefix,
      isCmd,
      command,         // e.g. "help" (tanpa prefix)
      args,            // e.g. ["arg1", "arg2"]
      argText,         // e.g. "arg1 arg2"
      sender,          // e.g. "628xxx@s.whatsapp.net"
      pushName,
      isGroup,
      remoteJid: m.key.remoteJid,
      quoted,
      quotedSender,
      contextInfo,
      mentions: contextInfo?.mentionedJid || []
    };
  }
}

module.exports = MessageParser;


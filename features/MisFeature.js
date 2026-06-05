const { Mistral } = require('@mistralai/mistralai');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const MIS_AGENT_ID = 'ag_019c3714472c7104b68a4864550769c3';

const MEDIA_MESSAGE_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'audioMessage',
  'stickerMessage',
  'documentWithCaptionMessage'
]);

function isMediaPayload(message) {
  if (!message) return false;
  const typeKeys = Object.keys(message);
  return typeKeys.some((key) => MEDIA_MESSAGE_TYPES.has(key));
}

function extractQuotedContext(quoted) {
  if (!quoted) return null;

  const text = quoted.conversation || quoted.extendedTextMessage?.text || quoted.extendedTextMessage?.matchedText;
  if (text) {
    return `User mbalas teks: "${text}"`;
  }
  return null;
}

function extractAnswerFromResponse(response) {
  // Get the last output from the conversation
  const outputs = response.outputs || [];
  
  for (let i = outputs.length - 1; i >= 0; i--) {
    const output = outputs[i];
    if (output.role === 'assistant' && output.content) {
      const content = output.content;
      
      // Try to parse as JSON and extract 'jawaban' field
      try {
        const parsed = JSON.parse(content);
        if (parsed.jawaban) {
          return parsed.jawaban;
        }
        // If no 'jawaban' field, stringify nicely or return as is
        if (typeof parsed === 'object') {
          return JSON.stringify(parsed, null, 2);
        }
      } catch {
        // Not JSON, return as plain text
        return content;
      }
    }
  }
  
  return null;
}

class MisFeature {
  constructor() {
    this.name = 'mis';
    this.description = '_(Mistral) by fahmyzzx_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { argText, remoteJid, quoted } = parsed;

    // Validate API key
    if (!config.mistral?.apiKey) {
      throw new AppError('Mistral API key belum diset di konfigurasi environment (MISTRAL_API_KEY).');
    }

    // Check for media - currently only text supported
    if (isMediaPayload(m.message)) {
      throw new AppError('Mis cuma bisa baca teks! Gambar-gambar ra paham aku!');
    }

    if (isMediaPayload(quoted)) {
      throw new AppError('Mis ra iso ngerti gambar/video yang kowe reply iku!');
    }

    const trimmedInput = (argText || '').trim();
    if (!trimmedInput) {
      const example = Formatter.code('!mis apa itu AI?');
      throw new AppError(`Opooo sih? Takon opo wae kek! Contoh: ${example}`);
    }

    // Build prompt with context
    const quotedContext = extractQuotedContext(quoted);
    const userMessage = quotedContext 
      ? `${trimmedInput}\n\n[Konteks]: ${quotedContext}` 
      : trimmedInput;

    // React with fire emoji
    await sock.sendMessage(remoteJid, { react: { text: '🔥', key: m.key } });

    try {
      const client = new Mistral({
        apiKey: config.mistral.apiKey
      });

      const messages = [
        { role: 'user', content: userMessage }
      ];

      // Use Mistral Agents API (beta.conversations.start)
      const response = await client.beta.conversations.start({
        agentId: MIS_AGENT_ID,
        inputs: messages
      });

      const responseContent = extractAnswerFromResponse(response);
      
      if (!responseContent) {
        throw new Error('Respon Mistral Agent kosong, lah piye iki?!');
      }

      // Format for WhatsApp
      const finalOutput = responseContent
        .replace(/\*\*(.*?)\*\*/g, '*$1*')  // **bold** to *bold*
        .replace(/###\s?(.*)/g, '*$1*')     // H3 to bold
        .replace(/##\s?(.*)/g, '*$1*')      // H2 to bold
        .replace(/#\s?(.*)/g, '*$1*');      // H1 to bold

      await sock.sendMessage(remoteJid, { text: finalOutput }, { quoted: m });

    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      console.error('[MIS FEATURE FAILURE]', error);
      throw new AppError(`Waduh gagal! ${errorMsg}`);
    } finally {
      // Remove reaction
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }
}

module.exports = MisFeature;

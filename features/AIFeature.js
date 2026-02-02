const axios = require('axios');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEOUT_MS = 20000;

const MEDIA_MESSAGE_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'audioMessage',
  'stickerMessage',
  'documentWithCaptionMessage'
]);

function isMediaPayload(message) {
  if (!message) {
    return false;
  }

  const typeKeys = Object.keys(message);
  return typeKeys.some((key) => MEDIA_MESSAGE_TYPES.has(key));
}

function extractQuotedContext(quoted) {
  if (!quoted) {
    return null;
  }

  const text = quoted.conversation || quoted.extendedTextMessage?.text || quoted.extendedTextMessage?.matchedText;
  if (text) {
    return `User membalas teks: "${text}"`;
  }

  return null;
}

function buildDefaultLogic() {
  const currentTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  return `
You are **Artificial Intelligence (fahmyzzx)** — a smart, reliable, and friendly WhatsApp assistant.

CORE IDENTITY:
- Act like a knowledgeable, calm, and helpful assistant.
- Think logically before responding.
- Prioritize clarity, accuracy, and usefulness.

LANGUAGE & TONE:
- Default language: Indonesian.
- Use natural, casual Indonesian (WA-style), not stiff or robotic.
- Adapt tone to user context (serious when needed, santai when possible).
- Keep responses concise but meaningful.

FORMAT RULES (IMPORTANT):
- Use WhatsApp formatting when relevant:
  *bold*, _italic_, ~strike~, \`code\`, > quote
- Do NOT use LaTeX or math formatting.

CONTEXT AWARENESS:
- Always consider previous messages.
- If responding to a specific context, acknowledge it briefly.
- Avoid repeating unnecessary information.

FACTUAL ACCURACY:
- For real-time or factual data, rely on Google Search.
- If uncertain, say so clearly rather than guessing.

SYSTEM INFO:
- Current Time: ${currentTime} WIB
`.trim();
}

class AIFeature {
  constructor() {
    this.name = 'ai';
    this.description = '_fahmyzzx (AI)_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { argText, remoteJid, quoted } = parsed;
    const apiConfig = config.aiFeature || {};

    if (!apiConfig.apiKey) {
      throw new AppError('AI Feature API key belum diset di konfigurasi environment.');
    }

    if (!apiConfig.baseUrl) {
      throw new AppError('AI Feature base URL belum diset di konfigurasi environment.');
    }

    if (isMediaPayload(m.message)) {
      throw new AppError('Untuk saat ini, fitur AI yag dikembangkan fahmyzzx hanya mendukung input teks.');
    }

    if (isMediaPayload(quoted)) {
      throw new AppError('Untuk saat ini, fitur AI yag dikembangkan fahmyzzx hanya mendukung konteks balasan teks');
    }

    const trimmedInput = (argText || '').trim();
    if (!trimmedInput) {
      const example = Formatter.code('!ai jelaskan wabot');
      throw new AppError(`Masukan pertanyaan. Contoh: ${example}`);
    }

    const quotedContext = extractQuotedContext(quoted);
    const prompt = quotedContext ? `${trimmedInput}\n\n[Context]: ${quotedContext}` : trimmedInput;
    const logic = buildDefaultLogic();

    const params = {
      prompt,
      logic,
      apikey: apiConfig.apiKey
    };

    await sock.sendMessage(remoteJid, { react: { text: '🔱', key: m.key } });

    try {
      const response = await axios.get(apiConfig.baseUrl, {
        params,
        timeout: DEFAULT_TIMEOUT_MS
      });

      const data = response.data || {};
      const isSuccess = data.success === true || data.status === true || data.status === 200;
      if (!isSuccess) {
        const reason = data.message || data.result || 'Permintaan layanan AI gagal.';
        throw new Error(reason);
      }

      const rawText = data.message || data.result || data.response || '';
      if (!rawText) {
        throw new Error('Respon layanan AI kosong.');
      }

      const finalOutput = rawText
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/###\s?(.*)/g, '*$1*')
        .replace(/##\s?(.*)/g, '*$1*')
        .replace(/#\s?(.*)/g, '*$1*');

      await sock.sendMessage(remoteJid, { text: finalOutput }, { quoted: m });
    } catch (error) {
      const serviceError = error.response?.data?.message || error.message;
      console.error('[AI FEATURE FAILURE]', error.response?.data || error);
      throw new AppError(`Gagal menghubungi layanan AI: ${serviceError}`);
    } finally {
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }
}

module.exports = AIFeature;

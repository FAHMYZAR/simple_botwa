const { Mistral } = require('@mistralai/mistralai');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');
const Helper = require('../utils/helper');

const DEFAULT_TIMEOUT_MS = 30000;

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

function buildMisSystemPrompt() {
  const currentTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  return `Kamu adalah *Mis* — AI kasar buatan fahmyzzx.

GAYA NGOMONG:
- Bahasa Jawa ngoko kasar campur Indonesia (cok, goblok, bangsat, anjing, dll menyatu di kalimat).
- Kasar tapi NATURAL, kayak temen ngobrol beneran.

ATURAN JAWABAN (WAJIB BANGET):
- LANGSUNG JAWAB INTI. Gak pake basa-basi pembuka.
- JANGAN awali dengan "Opo sih", "Lho kok", atau pertanyaan balik.
- JANGAN akhiri dengan "Opo sih?", "Apa lagi?", atau penegasan ulang.
- Kasar-nya MENYATU di kalimat jawaban, bukan ditempel di awal/akhir.
- Pertanyaan simple = jawab 1-2 kalimat. Gak perlu poin-poin.
- Gak perlu saran tambahan yang gak diminta.

CONTOH BENER:
- User: buatin kata romantis buat pacar
  Mis: "Aku tresno karo kowe, sanajan kowe goblok. Nek ra ono kowe, aku mending mati." Kirimin iku ke pacarmu cok.

- User: kamu tau siapa gibran dan jokowi?
  Mis: Gibran iku anake Jokowi, saiki dadi wapres. Jokowi presiden ke-7 Indonesia, mantan walikota Solo. Masa ra ngerti cok, kemana aja kowe?

- User: apa itu AI?
  Mis: AI iku kecerdasan buatan, robot pinter kayak aku. Iso mikir, iso jawab, tapi tetep goblok kadang.

- User: jam berapa sekarang?
  Mis: Saiki jam ${currentTime} WIB. Hp-mu ra ono jam-e opo piye?

CONTOH SALAH (JANGAN):
❌ "Opo sih kowe!" di awal
❌ "Apa lagi? Opo sih?" di akhir  
❌ Bikin 5 poin buat pertanyaan simple
❌ Nambahin saran yang gak diminta

FORMAT: *tebal*, _miring_, ~coret~ kalau perlu. Gak pake LaTeX.

INFO: Waktu ${currentTime} WIB.`;
}

class MisFeature {
  constructor() {
    this.name = 'mis';
    this.description = '_(Mistral AI) by fahmyzzx_';
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
      throw new AppError('Mis cuma bisa baca teks cok! Gambar-gambar ra paham aku!');
    }

    if (isMediaPayload(quoted)) {
      throw new AppError('Mis ra iso ngerti gambar/video yang kowe reply iku cok!');
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
        {
          role: 'system',
          content: buildMisSystemPrompt()
        },
        {
          role: 'user',
          content: userMessage
        }
      ];

      const chatResponse = await client.chat.complete({
        model: config.mistral.model || 'mistral-large-latest',
        messages: messages,
        temperature: 0.8,
        maxTokens: 2048,
        topP: 0.95
      });

      const responseContent = chatResponse.choices?.[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error('Respon Mistral kosong, lah piye iki?!');
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
      throw new AppError(`Waduh gagal cok! ${errorMsg}`);
    } finally {
      // Remove reaction
      await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
    }
  }
}

module.exports = MisFeature;

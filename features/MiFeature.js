const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');
const Helper = require('../utils/helper');

const SKIP_MESSAGE_TYPES = new Set([
  'videoMessage',
  'documentMessage',
  'audioMessage',
  'documentWithCaptionMessage'
]);

const EXPLICIT_WEB_SEARCH_KEYWORDS = [
  'cari di google',
  'cari di web',
  'search google',
  'search web',
  'googling',
  'browse',
  'browsing',
  'lihat di internet',
  'cek internet',
  'cek web',
  'telusuri',
  'riset online'
];

const WEB_SEARCH_KEYWORDS = [
  'hari ini',
  'saat ini',
  'sekarang',
  'terbaru',
  'terkini',
  'paling baru',
  'baru-baru ini',
  'belakangan ini',
  'minggu ini',
  'bulan ini',
  'tahun ini',
  'real time',
  'real-time',
  'realtime',
  'live',
  'latest',
  'current',
  'recent',
  'today',
  'now',
  'berita',
  'news',
  'kabar',
  'isu terbaru',
  'perkembangan',
  'breaking news',
  'viral',
  'trending',
  'sedang ramai',
  'sedang tren',
  'harga',
  'price',
  'kurs',
  'exchange rate',
  'nilai tukar',
  'saham',
  'ihsg',
  'crypto',
  'bitcoin',
  'emas',
  'cuaca',
  'weather',
  'jadwal',
  'schedule',
  'score',
  'skor',
  'hasil pertandingan',
  'klasemen',
  'ranking',
  'polling',
  'statistik terbaru',
  'rilis',
  'release',
  'changelog',
  'update versi',
  'versi terbaru',
  'documentation',
  'docs terbaru',
  'api terbaru',
  'library terbaru',
  'framework terbaru',
  'package terbaru',
  'dependency terbaru',
  'cve',
  'vulnerability',
  'kerentanan',
  'exploit terbaru',
  'patch',
  'security advisory',
  'cek apakah',
  'pastikan',
  'validasi',
  'verifikasi',
  'apakah benar',
  'benarkah',
  'buktikan',
  'sumbernya',
  'referensi',
  'link resmi',
  'source',
  'citation',
  'kutipan',
  'dekat saya',
  'near me',
  'alamat',
  'lokasi',
  'rute',
  'jam buka',
  'buka sekarang',
  'nomor telepon',
  'kontak resmi',
  'rekomendasi laptop',
  'rekomendasi hp',
  'rekomendasi vps',
  'rekomendasi hosting',
  'rekomendasi tools',
  'alternatif terbaik',
  'mana yang terbaik sekarang'
];

const MI_TOOL_REGISTRY = {
  help: { featureName: 'help', ownerOnly: false, requiresMedia: false },
  stats: { featureName: 'stats', ownerOnly: true, requiresMedia: false },
  ping: { featureName: 'ping', ownerOnly: false, requiresMedia: false },
  ig: { featureName: 'ig', ownerOnly: false, requiresMedia: false },
  remini: { featureName: 'remini', ownerOnly: false, requiresMedia: true },
  hd: { featureName: 'hd', ownerOnly: false, requiresMedia: true },
  rvo: { featureName: 'rvo', ownerOnly: false, requiresMedia: true },
  quote: { featureName: 'q', ownerOnly: false, requiresMedia: true },
  telesticker: { featureName: 'ts', ownerOnly: false, requiresMedia: true },
  smeme: { featureName: 'smeme', ownerOnly: false, requiresMedia: true },
  setbot: { featureName: 'setbot', ownerOnly: true, requiresMedia: false }
};

function shouldSkipPayload(message) {
  if (!message) {
    return false;
  }

  return Object.keys(message).some((key) => SKIP_MESSAGE_TYPES.has(key));
}

function getImagePayload(message) {
  if (!message) {
    return null;
  }

  if (message.imageMessage) {
    return {
      content: message.imageMessage,
      downloadType: 'image',
      mimeType: message.imageMessage.mimetype || 'image/jpeg'
    };
  }

  if (message.stickerMessage) {
    return {
      content: message.stickerMessage,
      downloadType: 'sticker',
      mimeType: message.stickerMessage.mimetype || 'image/webp'
    };
  }

  return null;
}

function getTextPayload(message) {
  if (!message) {
    return '';
  }

  return message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || '';
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

function detectUrls(text) {
  return String(text || '').match(/https?:\/\/[^\s]+/g) || [];
}

function getCurrentJakartaDateTime() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date()).replace(',', ' pukul');
}

function buildSystemInstruction() {
  return [
    'Jawab secara singkat dan cepat dengan format style WhatsApp:',
    '- Tebal pakai *1 bintang* bukan double',
    '- Miring pakai _underscore_',
    "- Code pakai 'single quote'",
    '- Quote pakai > di awal baris',
    '- Jangan pakai emoji yang lebay',
    '- Langsung to the point, jangan bertele-tele',
    '- Wajib pakai hasil search untuk pertanyaan tentang berita terkini, kondisi dunia hari ini, tanggal sekarang, peristiwa terbaru, atau data real-time',
    `- Tanggal dan waktu saat ini adalah ${getCurrentJakartaDateTime()} WIB`
  ].join('\n');
}

function buildFinalPrompt(prompt) {
  const urls = detectUrls(prompt);
  if (!urls.length) {
    return prompt;
  }

  return `URL yang perlu dianalisis: ${urls[0]}\n\nPertanyaan: ${prompt}`;
}

function buildDirectAnswerMessages(prompt) {
  return [
    {
      role: 'system',
      content: buildSystemInstruction() + '\n\nJawab langsung tanpa web search jika pertanyaan tidak membutuhkan data terbaru atau realtime.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];
}

function buildVisionMessages(prompt, imageBase64, mimeType) {
  return [
    {
      role: 'system',
      content: buildSystemInstruction() + '\n\nAnalisis gambar/sticker sesuai pertanyaan user. Jika user tidak memberi pertanyaan jelas, jelaskan isi media secara ringkas.'
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`
          }
        }
      ]
    }
  ];
}

function buildRefineMessages(finalPrompt, searchData) {
  return [
    {
      role: 'system',
      content: 'Kamu hanya bertugas membuat query pencarian baru yang lebih akurat. Jangan jawab pertanyaan user. Output hanya satu query pencarian tanpa penjelasan.'
    },
    {
      role: 'user',
      content: `PERTANYAAN_USER:\n${finalPrompt}\n\nSEARCH_RESULT_AWAL:\n${JSON.stringify(searchData, null, 2)}\n\nBuat query pencarian baru yang paling tepat dan terbaru.`
    }
  ];
}

function buildAnswerMessages(finalPrompt, searchData) {
  return [
    {
      role: 'system',
      content: buildSystemInstruction() + '\n\nJawab berdasarkan SEARCH_RESULT_FINAL. Jangan mengarang data realtime di luar hasil search. Prioritaskan hasil dengan timestamp paling baru. Abaikan hasil lama, cache, atau data yang tanggalnya tidak relevan. Kalau data realtime tidak cukup jelas, katakan bahwa hasil search belum cukup akurat.'
    },
    {
      role: 'user',
      content: `SEARCH_RESULT_FINAL:\n${JSON.stringify(searchData, null, 2)}\n\nPERTANYAAN_USER:\n${finalPrompt}`
    }
  ];
}

function buildIntentMessages(prompt, hasMediaInput) {
  return [
    {
      role: 'system',
      content: [
        'Kamu bertugas mengklasifikasikan intent user untuk fitur WhatsApp AI.',
        'Balas hanya JSON valid tanpa markdown.',
        'Field wajib: mode, refined_prompt, size.',
        'mode hanya boleh salah satu: chat, analyze, generate_image, generate_sticker, edit_image, edit_sticker, tool_call.',
        'Kalau ada typo seperti gmbr, gbar, stker, stciker, bikinin, ubahin, pahami maksud user.',
        `Kalau has_media_input=${hasMediaInput ? 'true' : 'false'}.`,
        'Jika user minta bikin gambar baru, pilih generate_image.',
        'Jika user minta bikin sticker/stiker baru, pilih generate_sticker.',
        'Jika ada media input dan user minta mengubah isi/media, pilih edit_image atau edit_sticker.',
        'Jika ada media input dan user hanya bertanya/menjelaskan isi media, pilih analyze.',
        'Jika user meminta menjalankan fitur bot seperti help, stats, rvo, remini, ig, ping, q, ts, smeme, hd, atau setbot, pilih tool_call.',
        'Jika user hanya bertanya biasa tanpa media generation/edit, pilih chat.',
        'Untuk size, pahami orientasi permintaan user. Contoh: portrait/potrait/story/vertikal -> 1024x1536, landscape/banner/horizontal -> 1536x1024, square/persegi/sticker -> 1024x1024.',
        'Gunakan size aman. Default 1024x1024 jika tidak jelas.',
        'refined_prompt harus rapi, jelas, dan siap dikirim ke model gambar jika mode generate/edit.',
        'Contoh output: {"mode":"generate_sticker","refined_prompt":"cute angry banana sticker, expressive, clean background, high quality","size":"1024x1024"}'
      ].join(' ')
    },
    {
      role: 'user',
      content: prompt
    }
  ];
}

function buildToolMessages(prompt, hasMediaInput) {
  return [
    {
      role: 'system',
      content: [
        'Kamu bertugas memilih fitur bot yang paling cocok untuk dijalankan.',
        'Balas hanya JSON valid tanpa markdown.',
        'Field wajib: tool, args_text.',
        `Kalau has_media_input=${hasMediaInput ? 'true' : 'false'}.`,
        'Daftar tool yang boleh: help, stats, ping, ig, remini, hd, rvo, quote, telesticker, smeme, setbot.',
        'Gunakan help untuk permintaan menu/bantuan/daftar command.',
        'Gunakan stats untuk status/statistik bot.',
        'Gunakan ping untuk tes respon bot.',
        'Gunakan ig untuk download Instagram.',
        'Gunakan remini untuk HD/increase quality gambar.',
        'Gunakan hd untuk convert video document jadi HD status/player.',
        'Gunakan rvo untuk ekstrak view once.',
        'Gunakan quote untuk quotly/q.',
        'Gunakan telesticker untuk import Telegram sticker atau sticker tools ts.',
        'Gunakan smeme untuk bikin sticker meme dari gambar/sticker reply.',
        'Gunakan setbot hanya untuk ubah mode public/private.',
        'Kalau tool butuh reply media tapi user belum memberi media, tetap pilih tool yang paling cocok dan biarkan fitur asli yang memvalidasi.',
        'Contoh output: {"tool":"stats","args_text":""}'
      ].join(' ')
    },
    {
      role: 'user',
      content: prompt
    }
  ];
}

async function getGoogleAiSearchData(prompt, systemPrompt) {
  try {
    const messages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    const baseUrl = String(config.googleAi?.baseUrl || '').replace(/\/$/, '');
    const apiKey = config.googleAi?.apiKey;

    if (!baseUrl || !apiKey) {
      return null;
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google-ai-mode',
        messages,
        stream: false
      })
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    return null;
  }
}

class RouterClient {
  constructor() {
    this.baseUrl = String(config.router?.baseUrl || '').replace(/\/$/, '');
    this.apiKey = config.router?.apiKey;
    this.chatModel = config.router?.chatModel;
    this.queryModel = config.router?.queryModel;
  }

  get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    };
  }

  requireApiKey() {
    if (!this.apiKey) {
      throw new AppError('Router API key belum diset di environment (ROUTER_API_KEY).');
    }
  }

  extractChatText(data) {
    const choice = data?.choices?.[0];
    const messageContent = choice?.message?.content;

    if (typeof messageContent === 'string') {
      return messageContent;
    }

    if (Array.isArray(messageContent)) {
      const joinedContent = messageContent
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (typeof item?.text === 'string') {
            return item.text;
          }
          if (typeof item?.content === 'string') {
            return item.content;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      if (joinedContent) {
        return joinedContent;
      }
    }

    if (typeof choice?.text === 'string') {
      return choice.text;
    }

    if (typeof data?.output_text === 'string') {
      return data.output_text;
    }

    if (Array.isArray(data?.output)) {
      const outputText = data.output
        .flatMap((item) => Array.isArray(item?.content) ? item.content : [item?.content])
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (typeof item?.text === 'string') {
            return item.text;
          }
          if (typeof item?.content === 'string') {
            return item.content;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      if (outputText) {
        return outputText;
      }
    }

    return '';
  }

  async search(query, maxResults = 5) {
    this.requireApiKey();

    const response = await fetch(`${this.baseUrl}/v1/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'searxng',
        query,
        search_type: 'web',
        max_results: maxResults,
        language: 'id'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Router search gagal.');
    }

    return response.json();
  }

  async chat(messages, model = this.chatModel) {
    this.requireApiKey();

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model,
        stream: false,
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Router chat gagal.');
    }

    const data = await response.json();
    return this.extractChatText(data);
  }
}

class AgnesImageClient {
  constructor() {
    this.baseUrl = String(config.agnes?.baseUrl || '').replace(/\/$/, '');
    this.apiKey = config.agnes?.apiKey;
    this.imageModel = config.agnes?.imageModel;
    this.imageSize = config.agnes?.imageSize;
  }

  get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    };
  }

  requireApiKey() {
    if (!this.apiKey) {
      throw new AppError('Agnes API key belum diset di environment (AGNES_API_KEY).');
    }
  }

  buildGenerationPayload(prompt, size = this.imageSize) {
    return {
      model: this.imageModel,
      prompt,
      size,
      return_base64: true,
      extra_body: {
        response_format: 'b64_json'
      }
    };
  }

  buildEditPayload(prompt, imageDataUri, size = this.imageSize) {
    return {
      model: this.imageModel,
      prompt,
      size,
      image: [imageDataUri],
      return_base64: true,
      extra_body: {
        response_format: 'b64_json'
      }
    };
  }

  async requestImage(payload) {
    this.requireApiKey();

    const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Agnes image generation gagal.');
    }

    return response.json();
  }

  extractGeneratedImage(response) {
    const candidates = [];

    const collectKnownImageFields = (value) => {
      if (typeof value?.b64_json === 'string') {
        candidates.push({ type: 'base64', mime: 'image/png', value: value.b64_json });
      }

      if (typeof value?.url === 'string') {
        candidates.push(this.candidateFromUrl(value.url));
      }

      if (typeof value?.image_url?.url === 'string') {
        candidates.push(this.candidateFromUrl(value.image_url.url));
      }

      if (typeof value?.inlineData?.data === 'string') {
        candidates.push({
          type: 'base64',
          mime: value.inlineData.mimeType || 'image/png',
          value: value.inlineData.data
        });
      }

      if (typeof value?.inline_data?.data === 'string') {
        candidates.push({
          type: 'base64',
          mime: value.inline_data.mime_type || 'image/png',
          value: value.inline_data.data
        });
      }
    };

    const walk = (value) => {
      if (value == null) {
        return;
      }

      if (typeof value === 'string') {
        if (value.startsWith('data:image/')) {
          candidates.push({ type: 'data_url', value });
        } else if (this.isImageUrl(value)) {
          candidates.push({ type: 'url', value });
        }
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }

      if (typeof value === 'object') {
        collectKnownImageFields(value);
        Object.values(value).forEach(walk);
      }
    };

    walk(response);
    return candidates[0] || null;
  }

  candidateFromUrl(url) {
    if (url.startsWith('data:image/')) {
      return { type: 'data_url', value: url };
    }

    return { type: 'url', value: url };
  }

  isImageUrl(value) {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      return /\.(png|jpe?g|webp|gif|svg)$/i.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  async imageCandidateToBuffer(candidate) {
    if (!candidate) {
      throw new Error('Response image API tidak berisi gambar.');
    }

    if (candidate.type === 'data_url') {
      const match = candidate.value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
      if (!match) {
        throw new Error('Format data URL gambar tidak valid.');
      }
      return {
        buffer: Buffer.from(match[2], 'base64'),
        mime: match[1]
      };
    }

    if (candidate.type === 'base64') {
      return {
        buffer: Buffer.from(candidate.value, 'base64'),
        mime: candidate.mime || 'image/png'
      };
    }

    if (candidate.type === 'url') {
      const response = await fetch(candidate.value);
      if (!response.ok) {
        throw new Error('Gagal mengambil gambar hasil Agnes dari URL.');
      }
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mime: response.headers.get('content-type') || 'image/png'
      };
    }

    throw new Error(`Tipe gambar tidak dikenal: ${candidate.type}`);
  }

  async generate(prompt, size = this.imageSize) {
    const response = await this.requestImage(this.buildGenerationPayload(prompt, size));
    const candidate = this.extractGeneratedImage(response);
    return this.imageCandidateToBuffer(candidate);
  }

  async edit(prompt, imageDataUri, size = this.imageSize) {
    const response = await this.requestImage(this.buildEditPayload(prompt, imageDataUri, size));
    const candidate = this.extractGeneratedImage(response);
    return this.imageCandidateToBuffer(candidate);
  }
}

class MiFeature {
  constructor() {
    this.name = 'mi';
    this.description = '_(Ai Aja)_';
    this.ownerOnly = false;
    this.statusTrackers = new Map();
  }

  formatElapsed(startMs) {
    const elapsedMs = Date.now() - startMs;
    return `${(elapsedMs / 1000).toFixed(1)}s`;
  }

  formatStatus(startMs, text) {
    return `[thinking ${this.formatElapsed(startMs)}] ${text}`;
  }

  async sendStatus(sock, remoteJid, m, startMs, text) {
    const msg = await sock.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) }, { quoted: m });

    const interval = setInterval(() => {
      sock.sendMessage(remoteJid, {
        text: this.formatStatus(startMs, this.statusTrackers.get(msg.key.id) || text),
        edit: msg.key
      }).catch(() => {});
    }, 1000);

    this.statusTrackers.set(msg.key.id + '_interval', interval);
    this.statusTrackers.set(msg.key.id, text);
    return msg;
  }

  async editStatus(sock, remoteJid, statusMessage, startMs, text) {
    if (!statusMessage?.key) {
      return sock.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) });
    }

    this.statusTrackers.set(statusMessage.key.id, text);
    return sock.sendMessage(remoteJid, {
      text: this.formatStatus(startMs, text),
      edit: statusMessage.key
    });
  }

  async finishStatus(sock, remoteJid, statusMessage, output, m) {
    if (statusMessage?.key) {
      const interval = this.statusTrackers.get(statusMessage.key.id + '_interval');
      if (interval) clearInterval(interval);
      this.statusTrackers.delete(statusMessage.key.id + '_interval');
      this.statusTrackers.delete(statusMessage.key.id);
    }

    if (!statusMessage?.key) {
      return sock.sendMessage(remoteJid, { text: output }, { quoted: m });
    }

    return sock.sendMessage(remoteJid, {
      text: output,
      edit: statusMessage.key
    });
  }

  normalizeMode(value) {
    const allowed = new Set(['chat', 'analyze', 'generate_image', 'generate_sticker', 'edit_image', 'edit_sticker', 'tool_call']);
    return allowed.has(value) ? value : 'chat';
  }

  isSimpleStickerConversion(prompt, imagePayload) {
    if (!imagePayload) {
      return false;
    }

    const text = String(prompt || '').toLowerCase();
    const mentionsSticker = /(stiker|sticker|stker|stciker)/.test(text);
    const mentionsComplexEdit = /(background|latar|anime|3d|warna|color|ganti|edit|ubah.+jadi|replace|hapus|remove|tambahkan|add|pakai style|style)/.test(text);

    return mentionsSticker && !mentionsComplexEdit;
  }

  inferSizeFromPrompt(prompt, mode) {
    const text = String(prompt || '').toLowerCase();

    if (mode === 'generate_sticker' || mode === 'edit_sticker') {
      return '1024x1024';
    }

    if (/\b(portrait|potrait|vertikal|vertical|story|poster|full body|setengah badan)\b/.test(text)) {
      return '1024x1536';
    }

    if (/\b(landscape|horizontal|banner|wide|panorama|thumbnail youtube)\b/.test(text)) {
      return '1536x1024';
    }

    if (/\b(square|persegi|kotak|sticker|stiker|logo|icon|ikon|pp|profil)\b/.test(text)) {
      return '1024x1024';
    }

    return config.agnes?.imageSize || '1024x1024';
  }

  normalizeSize(size, prompt, mode) {
    const normalized = String(size || '').trim().toLowerCase();

    if (/^\d+x\d+$/.test(normalized)) {
      return normalized;
    }

    if (['portrait', 'potrait', 'vertical', 'vertikal', 'story'].includes(normalized)) {
      return '1024x1536';
    }

    if (['landscape', 'horizontal', 'banner', 'wide'].includes(normalized)) {
      return '1536x1024';
    }

    if (['square', 'persegi', 'sticker', 'stiker'].includes(normalized)) {
      return '1024x1024';
    }

    return this.inferSizeFromPrompt(prompt, mode);
  }

  safeParseIntent(raw, fallbackPrompt, hasMediaInput) {
    const match = String(raw || '').match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        mode: hasMediaInput ? 'analyze' : 'chat',
        refined_prompt: fallbackPrompt,
        size: this.normalizeSize('', fallbackPrompt, hasMediaInput ? 'analyze' : 'chat')
      };
    }

    try {
      const parsed = JSON.parse(match[0]);
      const mode = this.normalizeMode(parsed.mode);
      const refinedPrompt = String(parsed.refined_prompt || fallbackPrompt).trim() || fallbackPrompt;
      return {
        mode,
        refined_prompt: refinedPrompt,
        size: this.normalizeSize(parsed.size, refinedPrompt, mode)
      };
    } catch {
      return {
        mode: hasMediaInput ? 'analyze' : 'chat',
        refined_prompt: fallbackPrompt,
        size: this.normalizeSize('', fallbackPrompt, hasMediaInput ? 'analyze' : 'chat')
      };
    }
  }

  async detectIntent(prompt, hasMediaInput, client) {
    const raw = await client.chat(buildIntentMessages(prompt, hasMediaInput), config.router?.queryModel);
    return this.safeParseIntent(raw, prompt, hasMediaInput);
  }

  safeParseTool(raw) {
    const match = String(raw || '').match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[0]);
      const tool = String(parsed.tool || '').toLowerCase().trim();
      if (!MI_TOOL_REGISTRY[tool]) {
        return null;
      }

      return {
        tool,
        argsText: String(parsed.args_text || '').trim()
      };
    } catch {
      return null;
    }
  }

  async detectTool(prompt, hasMediaInput, client) {
    const raw = await client.chat(buildToolMessages(prompt, hasMediaInput), config.router?.queryModel);
    return this.safeParseTool(raw);
  }

  isOwnerMessage(m, parsed) {
    const sender = parsed.sender || '';
    const normalizedSender = sender.replace('@s.whatsapp.net', '').replace('@lid', '');
    return m.key.fromMe || normalizedSender === config.ownerNumber;
  }

  buildToolParsed(parsed, toolConfig, argsText) {
    return {
      ...parsed,
      command: toolConfig.featureName,
      argText: argsText,
      args: argsText ? argsText.split(/\s+/) : []
    };
  }

  async executeToolCall(m, sock, parsed, client, prompt, hasMediaInput, statusMessage, startMs) {
    await this.editStatus(sock, parsed.remoteJid, statusMessage, startMs, 'Memilih fitur bot yang cocok...');
    const toolDecision = await this.detectTool(prompt, hasMediaInput, client);

    if (!toolDecision) {
      throw new Error('Belum bisa menentukan fitur bot yang cocok.');
    }

    const toolConfig = MI_TOOL_REGISTRY[toolDecision.tool];
    const features = Helper.loadFeatures();
    const feature = features.get(toolConfig.featureName);

    if (!feature) {
      throw new Error(`Fitur ${toolConfig.featureName} tidak ditemukan.`);
    }

    if ((toolConfig.ownerOnly || feature.ownerOnly) && !this.isOwnerMessage(m, parsed)) {
      throw new Error('Fitur ini hanya bisa dijalankan owner bot.');
    }

    await this.editStatus(sock, parsed.remoteJid, statusMessage, startMs, `Menjalankan fitur ${toolConfig.featureName}...`);
    await feature.execute(m, sock, this.buildToolParsed(parsed, toolConfig, toolDecision.argsText));
    await this.finishStatus(sock, parsed.remoteJid, statusMessage, 'Selesai.', m);
  }

  async needsWebSearch(prompt, client) {
    const normalizedPrompt = String(prompt || '').toLowerCase();

    if (EXPLICIT_WEB_SEARCH_KEYWORDS.some((keyword) => normalizedPrompt.includes(keyword))) {
      return true;
    }

    const decision = await client.chat([
      {
        role: 'system',
        content: 'Tentukan apakah prompt user butuh web search sebelum dijawab. Balas hanya dengan salah satu label ini tanpa penjelasan: WEB_SEARCH atau DIRECT_ANSWER. Pilih WEB_SEARCH jika pertanyaan butuh data terbaru, kondisi saat ini, verifikasi fakta yang bisa berubah, atau user secara eksplisit meminta mencari di web/search/google. Pilih DIRECT_ANSWER jika pertanyaan bisa dijawab dari pengetahuan umum tanpa data terbaru.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], config.router?.queryModel);

    const normalizedDecision = String(decision || '').trim().toUpperCase();
    if (normalizedDecision === 'WEB_SEARCH') {
      return true;
    }
    if (normalizedDecision === 'DIRECT_ANSWER') {
      return false;
    }

    return WEB_SEARCH_KEYWORDS.some((keyword) => normalizedPrompt.includes(keyword));
  }

  async analyzeMedia(client, prompt, imagePayload) {
    const mediaBuffer = await Helper.downloadMedia(imagePayload.content, imagePayload.downloadType);

    try {
      const form = new FormData();
      form.append('message', prompt);
      form.append('file', mediaBuffer, {
        filename: 'image.jpg',
        contentType: imagePayload.mimeType || 'image/jpeg'
      });

      const baseUrl = String(config.googleAi?.baseUrl || '').replace(/\/$/, '');
      const apiKey = config.googleAi?.apiKey;

      if (!baseUrl || !apiKey) {
        throw new Error('Google AI config belum diset.');
      }

      const response = await axios.post(`${baseUrl}/v1/chat/file`, form, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        },
        timeout: 60000
      });

      const data = response.data;
      if (data && data.success && data.content) {
        return data.content;
      }
    } catch (err) {
      console.error('[Google AI File Error]', err.message);
    }

    const mediaBase64 = mediaBuffer.toString('base64');
    return client.chat(buildVisionMessages(prompt, mediaBase64, imagePayload.mimeType));
  }

  async convertMediaToSticker(sock, remoteJid, m, statusMessage, startMs, imagePayload) {
    await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mengubah media jadi sticker...');
    const inputBuffer = await Helper.downloadMedia(imagePayload.content, imagePayload.downloadType);
    const stickerBuffer = await sharp(inputBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ lossless: true })
      .toBuffer();

    await sock.sendMessage(remoteJid, { sticker: stickerBuffer }, { quoted: m });
    await this.finishStatus(sock, remoteJid, statusMessage, 'Selesai.', m);
  }

  async generateOrEditMedia(sock, remoteJid, m, statusMessage, startMs, prompt, imagePayload, mode, size) {
    const agnesClient = new AgnesImageClient();
    const isStickerOutput = mode === 'generate_sticker' || mode === 'edit_sticker';
    const isEditMode = mode === 'edit_image' || mode === 'edit_sticker';

    await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Menyiapkan prompt gambar...');

    let result;
    if (isEditMode) {
      if (!imagePayload) {
        throw new Error('Mode edit butuh gambar atau sticker sebagai input.');
      }

      await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mengedit media...');
      const inputBuffer = await Helper.downloadMedia(imagePayload.content, imagePayload.downloadType);
      const imageDataUri = `data:${imagePayload.mimeType};base64,${inputBuffer.toString('base64')}`;
      result = await agnesClient.edit(prompt, imageDataUri, size);
    } else {
      await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Generating gambar ...');
      result = await agnesClient.generate(prompt, size);
    }

    await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mengirim hasil...');

    if (isStickerOutput) {
      const stickerBuffer = await sharp(result.buffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ lossless: true })
        .toBuffer();

      await sock.sendMessage(remoteJid, { sticker: stickerBuffer }, { quoted: m });
    } else {
      await sock.sendMessage(remoteJid, {
        image: result.buffer,
        mimetype: result.mime || 'image/png'
      }, { quoted: m });
    }

    await this.finishStatus(sock, remoteJid, statusMessage, 'Selesai.', m);
  }

  async handleChatMode(sock, remoteJid, m, statusMessage, startMs, finalPrompt, client) {
    await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mencari informasi...');
    let googleRaw = await getGoogleAiSearchData(finalPrompt);

    if (!googleRaw) {
      await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Gagal ambil data, coba sumber lain...');
      const shouldSearch = await this.needsWebSearch(finalPrompt, client);
      if (!shouldSearch) {
        googleRaw = await client.chat(buildDirectAnswerMessages(finalPrompt));
      } else {
        const searchDataAwal = await client.search(finalPrompt, 5);
        const refinedQuery = String(await client.chat(buildRefineMessages(finalPrompt, searchDataAwal), config.router?.queryModel)).trim().replace(/^"|"$/g, '');
        const searchDataFinal = await client.search(refinedQuery || finalPrompt, 8);
        googleRaw = await client.chat(buildAnswerMessages(finalPrompt, searchDataFinal));
      }
    }

    await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Mengolah jawaban...');
    const filterMessages = [
      { role: 'system', content: buildSystemInstruction() + '\n\nFormat ulang data berikut agar rapi sesuai gaya bahasa AI, to the point, dan langsung menjawab pertanyaan.' },
      { role: 'user', content: `Pertanyaan: ${finalPrompt}\n\nData mentah:\n${googleRaw}` }
    ];
    let finalAnswer = await client.chat(filterMessages, config.router?.chatModel || 'vpscombo');


    let output = String(finalAnswer || '')
      .replace(/\*\*(.*?)\*\*/g, '*$1*')
      .replace(/###\s?(.*)/g, '*$1*')
      .replace(/##\s?(.*)/g, '*$1*')
      .replace(/#\s?(.*)/g, '*$1*')
      .trim();

    if (!output) {
      await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Coba ulang...');
      const retryAnswer = await client.chat([
        {
          role: 'system',
          content: buildSystemInstruction() + '\n\nJawab ulang pertanyaan user secara langsung. Output hanya jawaban final, jangan kosong.'
        },
        {
          role: 'user',
          content: finalPrompt
        }
      ], config.router?.queryModel);

      output = String(retryAnswer || '')
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/###\s?(.*)/g, '*$1*')
        .replace(/##\s?(.*)/g, '*$1*')
        .replace(/#\s?(.*)/g, '*$1*')
        .trim();
    }

    if (!output) {
      throw new Error('Gagal menghasilkan jawaban.');
    }

    await this.finishStatus(sock, remoteJid, statusMessage, output, m);
  }

  async execute(m, sock, parsed) {
    const { argText, remoteJid, quoted } = parsed;

    if (shouldSkipPayload(m.message) || shouldSkipPayload(quoted)) {
      await sock.sendMessage(remoteJid, { text: 'Skip!' }, { quoted: m });
      return;
    }

    const currentImage = getImagePayload(m.message);
    const quotedImage = getImagePayload(quoted);
    const imagePayload = currentImage || quotedImage;
    const currentText = getTextPayload(m.message);
    const trimmedInput = (argText || currentText || '').replace(/^([!&])mi\b/i, '').trim();

    if (!trimmedInput && !imagePayload) {
      throw new AppError(`Masukan pertanyaan. Contoh: ${Formatter.code('!mi berita AI hari ini')}`);
    }

    const quotedContext = imagePayload ? null : extractQuotedContext(quoted);
    const userPrompt = quotedContext ? `${trimmedInput}\n\n[Konteks]: ${quotedContext}` : trimmedInput;
    const finalPrompt = buildFinalPrompt(userPrompt || 'Jelaskan isi media ini secara ringkas.');
    const client = new RouterClient();

    const startMs = Date.now();
    let statusMessage;

    try {
      statusMessage = await this.sendStatus(sock, remoteJid, m, startMs, 'Memahami permintaan...');

      if (this.isSimpleStickerConversion(userPrompt || finalPrompt, imagePayload)) {
        await this.convertMediaToSticker(sock, remoteJid, m, statusMessage, startMs, imagePayload);
        return;
      }

      const intent = await this.detectIntent(userPrompt || finalPrompt, Boolean(imagePayload), client);

      if (intent.mode === 'analyze') {
        if (!imagePayload) {
          throw new Error('Mode analisis media butuh gambar atau sticker sebagai input.');
        }

        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Media terdeteksi, tak baca sek...');
        const finalAnswer = await this.analyzeMedia(client, intent.refined_prompt || finalPrompt, imagePayload);
        const output = String(finalAnswer || '')
          .replace(/\*\*(.*?)\*\*/g, '*$1*')
          .replace(/###\s?(.*)/g, '*$1*')
          .replace(/##\s?(.*)/g, '*$1*')
          .replace(/#\s?(.*)/g, '*$1*')
          .trim();

        if (!output) {
          throw new Error('Maaf, media gagal dibaca. Coba ulang lagi.');
        }

        await this.finishStatus(sock, remoteJid, statusMessage, output, m);
        return;
      }

      if (['generate_image', 'generate_sticker', 'edit_image', 'edit_sticker'].includes(intent.mode)) {
        await this.generateOrEditMedia(
          sock,
          remoteJid,
          m,
          statusMessage,
          startMs,
          intent.refined_prompt || finalPrompt,
          imagePayload,
          intent.mode,
          intent.size || config.agnes?.imageSize
        );
        return;
      }

      if (intent.mode === 'tool_call') {
        await this.executeToolCall(m, sock, parsed, client, userPrompt || finalPrompt, Boolean(imagePayload), statusMessage, startMs);
        return;
      }

      await this.handleChatMode(sock, remoteJid, m, statusMessage, startMs, finalPrompt, client);
    } catch (error) {
      if (statusMessage?.key) {
        const interval = this.statusTrackers.get(statusMessage.key.id + '_interval');
        if (interval) clearInterval(interval);
        this.statusTrackers.delete(statusMessage.key.id + '_interval');
        this.statusTrackers.delete(statusMessage.key.id);
      }
      console.error('[MI FEATURE FAILURE]', error);
      throw new AppError(`Gagal menghubungi layanan Mi: ${error.message}`);
    }
  }
}

module.exports = MiFeature;

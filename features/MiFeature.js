const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

const MEDIA_MESSAGE_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'audioMessage',
  'stickerMessage',
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

function isMediaPayload(message) {
  if (!message) {
    return false;
  }

  return Object.keys(message).some((key) => MEDIA_MESSAGE_TYPES.has(key));
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
    return data?.choices?.[0]?.message?.content || '';
  }
}

class MiFeature {
  constructor() {
    this.name = 'mi';
    this.description = '_(Mi AI Search) by fahmyzzx_';
    this.ownerOnly = false;
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

  formatElapsed(startMs) {
    const elapsedMs = Date.now() - startMs;
    return `${(elapsedMs / 1000).toFixed(1)}s`;
  }

  formatStatus(startMs, text) {
    return `[thinking ${this.formatElapsed(startMs)}] ${text}`;
  }

  async sendStatus(sock, remoteJid, m, startMs, text) {
    return sock.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) }, { quoted: m });
  }

  async editStatus(sock, remoteJid, statusMessage, startMs, text) {
    if (!statusMessage?.key) {
      return sock.sendMessage(remoteJid, { text: this.formatStatus(startMs, text) });
    }

    return sock.sendMessage(remoteJid, {
      text: this.formatStatus(startMs, text),
      edit: statusMessage.key
    });
  }

  async finishStatus(sock, remoteJid, statusMessage, output, m) {
    if (!statusMessage?.key) {
      return sock.sendMessage(remoteJid, { text: output }, { quoted: m });
    }

    return sock.sendMessage(remoteJid, {
      text: output,
      edit: statusMessage.key
    });
  }

  async execute(m, sock, parsed) {
    const { argText, remoteJid, quoted } = parsed;

    if (isMediaPayload(m.message)) {
      throw new AppError('Mi sementara hanya mendukung input teks.');
    }

    if (isMediaPayload(quoted)) {
      throw new AppError('Mi sementara hanya mendukung konteks balasan teks.');
    }

    const trimmedInput = (argText || '').trim();
    if (!trimmedInput) {
      throw new AppError(`Masukan pertanyaan. Contoh: ${Formatter.code('!mi berita AI hari ini')}`);
    }

    const quotedContext = extractQuotedContext(quoted);
    const userPrompt = quotedContext ? `${trimmedInput}\n\n[Konteks]: ${quotedContext}` : trimmedInput;
    const finalPrompt = buildFinalPrompt(userPrompt);
    const client = new RouterClient();

    const startMs = Date.now();
    let statusMessage;

    try {
      statusMessage = await this.sendStatus(sock, remoteJid, m, startMs, 'Sek tak pikire...🔥');
      const shouldSearch = await this.needsWebSearch(finalPrompt, client);

      let finalAnswer;
      let refinedQuery = null;
      if (!shouldSearch) {
        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Gaperlu golek jawaban nek internet, gampang iki..');
        finalAnswer = await client.chat(buildDirectAnswerMessages(finalPrompt));
      } else {
        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Pertanyaan mu butuh data terbaru, tak goleki nek web sek ya..');
        const searchDataAwal = await client.search(finalPrompt, 5);
        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Hasil awal sudah didapat.');
        refinedQuery = String(await client.chat(buildRefineMessages(finalPrompt, searchDataAwal), config.router?.queryModel)).trim().replace(/^"|"$/g, '');
        await this.editStatus(sock, remoteJid, statusMessage, startMs, `Keputusan final: ${refinedQuery || finalPrompt}`);
        const searchDataFinal = await client.search(refinedQuery || finalPrompt, 8);
        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Sedelak maning..');
        finalAnswer = await client.chat(buildAnswerMessages(finalPrompt, searchDataFinal));
        await this.editStatus(sock, remoteJid, statusMessage, startMs, `🔍Pencarian = ${refinedQuery || finalPrompt}`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      let output = String(finalAnswer || '')
        .replace(/\*\*(.*?)\*\*/g, '*$1*')
        .replace(/###\s?(.*)/g, '*$1*')
        .replace(/##\s?(.*)/g, '*$1*')
        .replace(/#\s?(.*)/g, '*$1*')
        .trim();

      if (!output) {
        await this.editStatus(sock, remoteJid, statusMessage, startMs, 'Respon kosong, mencoba ulang pakai model cepat');
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
        throw new Error('Respon Mi kosong setelah retry model cepat.');
      }

      await this.finishStatus(sock, remoteJid, statusMessage, output, m);
    } catch (error) {
      console.error('[MI FEATURE FAILURE]', error);
      throw new AppError(`Gagal menghubungi layanan Mi: ${error.message}`);
    }
  }
}

module.exports = MiFeature;

const config = require('../config/config');

class AiFeature {
  constructor() {
    this.name = 'ai';
    this.description = '_(AI) by fahmyzzx_';
    this.ownerOnly = false;
  }

  async execute(m, sock) {
    try {
      // ===============================
      // 1. Ambil teks pesan
      // ===============================
      const messageText =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        '';

      let prompt = messageText.trim().split(' ').slice(1).join(' ');

      // ===============================
      // 2. Handle quoted message (teks saja)
      // ===============================
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (quoted) {
        if (quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '_maaf, AI hanya mendukung pesan teks untuk saat ini_'
          });
          return;
        }

        const quotedText =
          quoted.conversation ||
          quoted.extendedTextMessage?.text ||
          '';

        if (quotedText) {
          prompt = prompt
            ? `${prompt}\n\nContext:\n${quotedText}`
            : quotedText;
        }
      }

      if (!prompt) {
        await sock.sendMessage(m.key.remoteJid, {
          text: 'Masukan pertanyaan atau reply pesan teks.\nContoh: /ai apa kabar?'
        });
        return;
      }

      // ===============================
      // 3. Kirim reaction (indikator proses)
      // ===============================
      await sock.sendMessage(m.key.remoteJid, {
        react: { text: '👨🏻‍💻', key: m.key }
      });

      // Delay kecil biar WA server aman
      await new Promise(r => setTimeout(r, 600));

      // ===============================
      // 4. System prompt
      // ===============================
      const now = new Date();
      const currentDateTime = now.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta'
      });

      const systemPrompt = `ARTIFICIAL INTELLIGENCE by fahmyzzx

ATURAN
- Jangan awali dengan perkenalan
- Langsung ke inti
- Singkat, padat, natural
- Bahasa indonesia gaul tapi sopan
- Format WhatsApp (* _ \` >)

Waktu sekarang: ${currentDateTime} WIB

User Query:
${prompt}`;

      const apiUrl =
        `https://api.sansekai.my.id/api/ai/cici?prompt=` +
        encodeURIComponent(systemPrompt);

      // ===============================
      // 5. Fetch AI (pakai timeout)
      // ===============================
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(apiUrl, {
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`API Error ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.chat) {
        throw new Error('No AI response');
      }

      let replyText = data.chat
        .replace(/\\n/g, '\n')
        .replace(/\*\*/g, '*');

      // ===============================
      // 6. Kirim jawaban
      // ===============================
      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText },
        { quoted: m }
      );

      // ===============================
      // 7. Hapus reaction (PAKAI DELAY)
      // ===============================
      await new Promise(r => setTimeout(r, 800));

      await sock.sendMessage(m.key.remoteJid, {
        react: { text: '', key: m.key }
      });

    } catch (error) {
      console.error('[AI] Error:', error.message);

      // Jangan balas kalau kena rate limit
      if (error.message?.includes('rate-overlimit')) {
        return;
      }

      try {
        await sock.sendMessage(m.key.remoteJid, {
          text: 'Maaf, AI sedang sibuk atau terjadi kesalahan.'
        });
      } catch {
        // sengaja dikosongkan (biar tidak loop)
      }
    }
  }
}

module.exports = AiFeature;

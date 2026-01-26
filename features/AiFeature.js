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
      // 2. Handle quoted text (tanpa media)
      // ===============================
      const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (quoted) {
        if (quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '_AI hanya mendukung pesan teks untuk saat ini_'
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
      // 3. System Prompt (ringkas & efisien)
      // ===============================
      const now = new Date();
      const currentDateTime = now.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta'
      });

      const systemPrompt = `Jawab sebagai AI WhatsApp.
- Langsung ke inti
- Singkat, natural, sopan
- Bahasa Indonesia santai
- Gunakan format WhatsApp (* _ \` >)
- Jangan pakai LaTeX

Waktu: ${currentDateTime} WIB

User:
${prompt}`;

      const apiUrl =
        `https://api.sansekai.my.id/api/ai/cici?prompt=` +
        encodeURIComponent(systemPrompt);

      // ===============================
      // 4. Fetch AI (dengan timeout)
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

      if (!data?.chat) {
        throw new Error('No AI response');
      }

      const replyText = data.chat
        .replace(/\\n/g, '\n')
        .replace(/\*\*/g, '*');

      // ===============================
      // 5. Kirim jawaban (1x saja)
      // ===============================
      await sock.sendMessage(
        m.key.remoteJid,
        { text: replyText },
        { quoted: m }
      );

    } catch (error) {
      console.error('[AI] Error:', error.message);

      // Jangan balas kalau kena rate limit
      if (error.message?.includes('rate-overlimit')) return;

      try {
        await sock.sendMessage(m.key.remoteJid, {
          text: 'Maaf, AI sedang sibuk atau terjadi kesalahan.'
        });
      } catch {
        // sengaja kosong, cegah loop
      }
    }
  }
}

module.exports = AiFeature;

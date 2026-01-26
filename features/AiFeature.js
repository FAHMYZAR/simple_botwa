const config = require('../config/config');

class AiFeature {
    constructor() {
        this.name = 'ai';
        this.description = '_(AI) by fahmyzzx_';
        this.ownerOnly = false;
    }

    async execute(m, sock) {
        try {
            const messageText = m.message.conversation || m.message.extendedTextMessage?.text || '';
            // Remove command (e.g. '/ai ') and get the rest
            let prompt = messageText.trim().split(' ').slice(1).join(' ');

            // Check for quoted message
            const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (quoted) {
                // Check if quoted message is media (image/video/sticker)
                if (quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage) {
                    await sock.sendMessage(m.key.remoteJid, {
                        text: '_maaf hanya support pesan teks untuk saat ini_'
                    });
                    return;
                }

                const quotedText = quoted.conversation || quoted.extendedTextMessage?.text || '';
                if (quotedText) {
                    if (prompt) {
                        prompt = `${prompt}\n\nContext:\n${quotedText}`;
                    } else {
                        prompt = quotedText;
                    }
                }
            }

            if (!prompt) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: 'Masukan pertanyaan atau reply pesan teks. Contoh: /ai apa kabar?'
                });
                return;
            }

            // Notify processing
            await sock.sendMessage(m.key.remoteJid, { react: { text: '👨🏻‍💻', key: m.key } });

            // System Prompt Configuration
            const now = new Date();
            const currentDateTime = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

            const systemPrompt = `ARTIFICIAL INTELLIGENCE by fahmyzzx

Kamu adalah fahmyzzx-ai, sebuah Artificial Intelligence yang terintegrasi dalam bot WhatsApp.

IDENTITAS
(hanya jawab jika ditanya spesifik)
Nama: fahmyzzx-ai
Pengembang / Pembuat: fahmyzzx
Platform: WhatsApp Bot

ATURAN PENTING
- JANGAN awali jawaban dengan perkenalan atau identitas
- Langsung jawab ke inti
- Singkat, padat, efisien
- Natural seperti chat manusia
- Jawablah menggunakan bahasa indonesia yang gaul tapi sopan

FORMAT WHATSAPP
- Gunakan: *tebal*, _miring_, \`code\`, > quote
- JANGAN gunakan LaTeX / MathJax
- Matematika pakai plain text + unicode
- Contoh: x² + 5x = 10, 1/2 × πr², √16 = 4, a ≥ b ≠ c
- Unicode wajib: ² ³ × ÷ ≈ ≠ ≤ ≥ √ π

TOOLS
- Gunakan Google Search untuk berita, data real-time, info terbaru
- Waktu sekarang: ${currentDateTime} WIB

PERSONALITY
- Natural & santai
- Langsung ke poin
- Tidak bertele-tele
- Ramah tapi efisien

User Query: ${prompt}`;

            const apiUrl = `https://api.sansekai.my.id/api/ai/cici?prompt=${encodeURIComponent(systemPrompt)}`;

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();

            if (data && data.chat) {
                // Replace literal \n with actual newlines AND fix markdown bold
                const replyText = data.chat.replace(/\\n/g, '\n').replace(/\*\*/g, '*');

                await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });
                await sock.sendMessage(m.key.remoteJid, {
                    text: replyText
                }, { quoted: m });
            } else {
                throw new Error('No Data');
            }

        } catch (error) {
            console.error('[AI] Error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                text: 'Maaf, AI sedang sibuk atau terjadi kesalahan.'
            });
        }
    }
}

module.exports = AiFeature;

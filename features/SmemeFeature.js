const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class SmemeFeature {
    constructor() {
        this.name = 'smeme';
        this.description = '_Buat sticker meme_';
        this.ownerOnly = false;
    }

    async execute(m, sock, parsed) {
        // Manual args extraction bypassed, using parsed
        let argText = parsed.argText;

        const quoted = parsed.quoted;

        if (!quoted || (!quoted.imageMessage && !quoted.stickerMessage)) {
            throw new AppError(`Reply gambar/sticker dengan teks!\n\nContoh: ${Formatter.code('.smeme teks atas|teks bawah')}`);
        }

        if (!argText) {
            throw new AppError(`Masukkan teks!\n\nContoh: ${Formatter.code('.smeme teks atas|teks bawah')}\nAtau: ${Formatter.code('.smeme teks atas')}`);
        }

        await sock.sendMessage(parsed.remoteJid, { react: { text: '⏳', key: m.key } });

        // Download media
        let buffer;
        if (quoted.imageMessage) {
            buffer = await downloadMediaMessage(
                { message: { imageMessage: quoted.imageMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
        } else if (quoted.stickerMessage) {
            const stickerBuffer = await downloadMediaMessage(
                { message: { stickerMessage: quoted.stickerMessage } },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
            // Convert WebP sticker to PNG
            buffer = await sharp(stickerBuffer).png().toBuffer();
        }

        // Parse text
        const [topText, bottomText] = argText.includes('|') ? argText.split('|') : [argText, ''];

        // Create meme
        const memeBuffer = await this.createMeme(buffer, topText.trim(), bottomText.trim());

        // Convert to sticker
        const stickerBuffer = await sharp(memeBuffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ quality: 95 })
            .toBuffer();

        // Hapus react sebelum kirim sticker
        await sock.sendMessage(parsed.remoteJid, {
            react: { text: '', key: m.key }
        });

        await sock.sendMessage(parsed.remoteJid, { sticker: stickerBuffer }, { quoted: m });
    }

    async createMeme(imageBuffer, topText, bottomText) {
        // Load image
        const image = await loadImage(imageBuffer);

        // Create canvas with image dimensions
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Draw image
        ctx.drawImage(image, 0, 0);

        // Setup text style (Impact font style)
        const fontSize = Math.floor(image.width / 10);
        ctx.font = `900 ${fontSize}px Impact, sans-serif`; // 900 = extra bold
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Draw top text
        if (topText) {
            const lines = this.wrapText(ctx, topText.toUpperCase(), image.width - 20);
            let y = 20;
            lines.forEach(line => {
                this.drawTextWithStroke(ctx, line, image.width / 2, y, fontSize);
                y += fontSize;
            });
        }

        // Draw bottom text
        if (bottomText) {
            const lines = this.wrapText(ctx, bottomText.toUpperCase(), image.width - 20);
            let y = image.height - (lines.length * fontSize) - 20;
            lines.forEach(line => {
                this.drawTextWithStroke(ctx, line, image.width / 2, y, fontSize);
                y += fontSize;
            });
        }

        return canvas.toBuffer('image/png');
    }

    drawTextWithStroke(ctx, text, x, y, fontSize) {
        // Stroke lebih tebal dengan multiple layer
        const strokeWidth = Math.floor(fontSize / 8);

        // Layer 1: Stroke hitam tebal
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(text, x, y);

        // Layer 2: Fill putih
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x, y);
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }
}

module.exports = SmemeFeature;

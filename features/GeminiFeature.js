const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');
const Helper = require('../utils/helper');

class GeminiFeature {
  constructor() {
    this.name = 'gem';
    this.description = '_(Gemini 3 AI) by fahmyzzx_';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    const { argText, remoteJid, quoted } = parsed;
    
    // 1. Prepare Content Pieces
    let prompt = argText || '';
    let mediaData = null;
    let mediaType = null;
    let quotedContext = null;
    
    // Check current message for media
    if (m.message?.imageMessage) {
        mediaData = await Helper.downloadMedia(m.message.imageMessage, 'image');
        mediaType = 'image/jpeg';
        prompt = m.message.imageMessage.caption || prompt;
    } else if (m.message?.documentMessage && m.message.documentMessage.mimetype === 'application/pdf') {
        mediaData = await Helper.downloadMedia(m.message.documentMessage, 'document');
        mediaType = 'application/pdf';
        prompt = m.message.documentMessage.caption || prompt;
    }
    
    // Check quoted message for context
    if (quoted) {
        const quotedMsg = quoted;
        if (quotedMsg.imageMessage && !mediaData) {
            mediaData = await Helper.downloadMedia(quotedMsg.imageMessage, 'image');
            mediaType = 'image/jpeg';
            quotedContext = "User is replying to this image.";
        } else if (quotedMsg.documentMessage && quotedMsg.documentMessage.mimetype === 'application/pdf' && !mediaData) {
            mediaData = await Helper.downloadMedia(quotedMsg.documentMessage, 'document');
            mediaType = 'application/pdf';
            quotedContext = "User is replying to this PDF document.";
        } else if (quotedMsg.conversation || quotedMsg.extendedTextMessage) {
            const text = quotedMsg.conversation || quotedMsg.extendedTextMessage.text;
            quotedContext = `User is replying to this text: "${text}"`;
        }
    }

    if (!prompt && !mediaData) {
        throw new AppError(`Masukan pertanyaan atau reply media/teks.\nContoh: ${Formatter.code('&gem apa ini?')}`);
    }

    // 2. Decide Model & Tools
    let modelId = 'gemini-3-flash-preview';
    let tools = [{ "googleSearch": {} }, { "urlContext": {} }];
    let generationConfig = {
        temperature: 1.0
    };

    // If request for image generation or explicitly mentioned
    const isImageRequest = /\b(buatkan|gambar|lukis|generate|draw|show me)\b/i.test(prompt) && !mediaData;
    if (isImageRequest) {
        modelId = 'gemini-3-pro-image-preview';
        generationConfig.imageConfig = {
            aspectRatio: "4:3",
            imageSize: "2K"
        };
    } else {
        // Only add thinkingConfig for non-image models
        generationConfig.thinkingConfig = { thinkingLevel: "high" };
    }

    const apiUrl = `${config.gemini.baseUrl}${modelId}:generateContent?key=${config.gemini.apiKey}`;

    // 3. Construct Payload
    const parts = [];
    
    // System Instruction - included in prompt for simplicity in Flash
    const systemPrompt = `You are "Artificial Intelligence (fahmyzzx)", a highly intelligent and helpful WhatsApp bot.
- Current Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.
- Respond naturally and concisely in Indonesian (unless user asks otherwise).
- Use WhatsApp formatting: *bold*, _italic_, ~strike~, \`code\`, and > quote.
- Use Google Search tool for real-time/factual data.
- If replying to context, acknowledge it.
- Never use LaTeX.

${quotedContext ? `[CONTEXT]: ${quotedContext}\n` : ''}[PROMPT]: ${prompt}`;

    parts.push({ text: systemPrompt });

    if (mediaData) {
        parts.push({
            inlineData: {
                mimeType: mediaType,
                data: mediaData.toString('base64')
            },
            mediaResolution: {
                level: mediaType === 'application/pdf' ? 'media_resolution_medium' : 'media_resolution_high'
            }
        });
    }

    const payload = {
        contents: [{ role: "user", parts }],
        tools: isImageRequest ? [{ "googleSearch": {} }] : tools,
        generationConfig
    };

    // React with diamond at the start
    await sock.sendMessage(remoteJid, { react: { text: '💎', key: m.key } });

    // 4. API Call
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('Gemini API Error:', errData);
            throw new Error(`Gemini API Error: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        
        if (!candidate || !candidate.content) {
            throw new Error('No response content from Gemini');
        }

        // 5. Handle Response
        const responseText = candidate.content.parts.map(p => p.text).join('\n');
        const inlineData = candidate.content.parts.find(p => p.inlineData)?.inlineData;

        if (inlineData) {
            // It returned an image (Image Generation)
            const buffer = Buffer.from(inlineData.data, 'base64');
            await sock.sendMessage(remoteJid, { 
                image: buffer, 
                caption: responseText || 'Ini hasilnya.' 
            }, { quoted: m });
        } else {
            // Text response
            // Process formatting (WhatsApp style)
            let finalOutput = responseText
                .replace(/\*\*(.*?)\*\*/g, '*$1*') // **bold** to *bold*
                .replace(/### (.*)/g, '*$1*')    // H3 to bold
                .replace(/## (.*)/g, '*$1*')     // H2 to bold
                .replace(/# (.*)/g, '*$1*');     // H1 to bold

            await sock.sendMessage(remoteJid, { text: finalOutput }, { quoted: m });
        }

        // Remove reaction after response
        await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });

    } catch (error) {
        // Remove reaction even on error
        await sock.sendMessage(remoteJid, { react: { text: '', key: m.key } });
        console.error('[GEMINI FAILURE]', error);
        throw new AppError(`Gagal menghubungi Gemini: ${error.message}`);
    }
  }
}

module.exports = GeminiFeature;

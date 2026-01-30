const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class HdFeature {
    constructor() {
        this.name = 'hdsw';
        this.description = '_Hd status Wa_';
        this.ownerOnly = false;
    }

    async execute(m, sock, parsed) {
        // Extract args from parsed
        const customCaption = parsed.argText;

        const quoted = parsed.quoted;
        const documentMessage = m.message?.documentMessage || quoted?.documentMessage;

        if (!documentMessage) {
            throw new AppError(`Reply document video dengan ${Formatter.code('.hdsw [caption]')} untuk convert ke media player HD!`);
        }

        // Cek apakah document adalah video
        const mimetype = documentMessage.mimetype || '';
        if (!mimetype.includes('video')) {
            throw new AppError('Document harus berupa video!');
        }

        // Cek ukuran file (max 250MB)
        const fileSize = documentMessage.fileLength || 0;
        const sizeInMB = fileSize / (1024 * 1024);

        if (sizeInMB > 250) {
            throw new AppError(`Video terlalu besar! (${sizeInMB.toFixed(2)} MB)\nMaksimal 250 MB.`);
        }

        const estimatedTime = Math.ceil(sizeInMB * 2.5);
        const progressMsg = await sock.sendMessage(parsed.remoteJid, {
            text: `${Formatter.bold('⏳ Processing video HD...')}\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Estimasi: ~${estimatedTime}s\n📊 Progress: [░░░░░░░░░░] 0%`
        });

        // Update progress: Downloading
        await sock.sendMessage(parsed.remoteJid, {
            text: `${Formatter.bold('⏳ Downloading video...')}\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Estimasi: ~${estimatedTime}s\n📊 Progress: [██░░░░░░░░] 20%`,
            edit: progressMsg.key
        });

        // Download document
        const buffer = await downloadMediaMessage(
            { message: { documentMessage } },
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer) {
            throw new AppError('Gagal download video!');
        }

        // Corrected path to temp directory
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const inputFile = path.join(tempDir, `hd_input_${Date.now()}.mp4`);
        const outputFile = path.join(tempDir, `hd_output_${Date.now()}.mp4`);
        fs.writeFileSync(inputFile, buffer);

        // Update progress: Analyzing
        await sock.sendMessage(parsed.remoteJid, {
            text: `${Formatter.bold('⏳ Analyzing video...')}\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Estimasi: ~${estimatedTime}s\n📊 Progress: [████░░░░░░] 40%`,
            edit: progressMsg.key
        });

        // Path to local FFmpeg binaries
        const binDir = path.join(__dirname, '../bin');
        const ffmpegPath = path.join(binDir, 'ffmpeg');
        const ffprobePath = path.join(binDir, 'ffprobe');

        // Detect video properties
        const probeCmd = `"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate -of json "${inputFile}"`;
        let fps = 30; // Default fps if detection fails

        try {
            const { stdout: probeOutput } = await execPromise(probeCmd);
            const videoInfo = JSON.parse(probeOutput);
            const stream = videoInfo.streams?.[0];

            if (stream) {
                if (stream.r_frame_rate) {
                    const fpsRatio = stream.r_frame_rate.split('/');
                    const originalFps = Math.round(parseInt(fpsRatio[0]) / parseInt(fpsRatio[1]));
                    fps = Math.min(originalFps, 60); // Max 60fps
                }
            }
        } catch (e) {
            console.error('Probe error, defaulting to 30fps', e);
        }

        // Optimized HD Compression using local FFmpeg
        const ffmpegCmd = `"${ffmpegPath}" -i "${inputFile}" \
                -c:v libx264 \
                -preset veryfast \
                -crf 23 \
                -maxrate 8000k \
                -bufsize 16000k \
                -r ${fps} \
                -profile:v high \
                -vf "scale='min(2560,iw)':'min(2560,ih)':force_original_aspect_ratio=decrease,format=yuv420p" \
                -c:a aac \
                -b:a 128k \
                -ar 44100 \
                -movflags +faststart \
                -max_muxing_queue_size 9999 \
                -y "${outputFile}"`;

        // Update progress: Compressing dengan animasi
        const startTime = Date.now();

        // Progress animation during FFmpeg processing
        const progressInterval = setInterval(async () => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const progress = Math.min(95, 60 + Math.floor(elapsed / 2)); // 60% -> 95% gradually
            const bars = Math.floor(progress / 10);
            const progressBar = '█'.repeat(bars) + '░'.repeat(10 - bars);

            await sock.sendMessage(parsed.remoteJid, {
                text: `⏳ Compressing video (Normalizing Codec)...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Elapsed: ${elapsed}s\n📊 Progress: [${progressBar}] ${progress}%`,
                edit: progressMsg.key
            }).catch(() => { });
        }, 2000); // Update every 2 seconds

        try {
            await execPromise(ffmpegCmd);
            clearInterval(progressInterval);

            const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

            // Update progress: Finalizing
            await sock.sendMessage(m.key.remoteJid, {
                text: `⏳ Finalizing...\n\n📦 Size: ${sizeInMB.toFixed(2)} MB\n⏱️ Elapsed: ${processingTime}s\n📊 Progress: [██████████] 100%`,
                edit: progressMsg.key
            });

            // Kirim video hasil kompresi
            const compressedBuffer = fs.readFileSync(outputFile);
            const finalSize = compressedBuffer.length / (1024 * 1024);
            const compression = ((1 - (finalSize / sizeInMB)) * 100).toFixed(1);

            // Update progress message dengan hasil
            await sock.sendMessage(m.key.remoteJid, {
                text: `✅ Video HD selesai!\n\n📊 ${sizeInMB.toFixed(2)}MB → ${finalSize.toFixed(2)}MB (-${compression}%)\n🎬 ${fps}fps HD\n⚡ ${processingTime}s`,
                edit: progressMsg.key
            });

            await sock.sendMessage(m.key.remoteJid, {
                video: compressedBuffer,
                caption: customCaption || undefined,
                gifPlayback: false
            });

            // Cleanup
            try {
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
                console.log('[HD] Cleanup success');
            } catch (e) {
                console.log('Cleanup error:', e.message);
            }
        
        } catch (ffmpegErr) {
            clearInterval(progressInterval);
            // Cleanup on error too
            try {
                if(fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                if(fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch {}
            throw new Error('FFmpeg processing failed: ' + ffmpegErr.message);
        }
    }
}

module.exports = HdFeature;

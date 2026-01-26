const os = require('os');
const fs = require('fs');
const path = require('path');
const process = require('process');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');

class StatsFeature {
    constructor() {
        this.name = 'stats';
        this.description = '_Tampilkan statistik bot_';
        this.ownerOnly = true;
        this.bannerUrl = 'https://image.web.id/images/github-2.jpg';
        this.githubUrl = 'https://github.com/FAHMYZAR';
    }

    async execute(m, sock) {
        try {
            await sock.sendMessage(m.key.remoteJid, { react: { text: '📊', key: m.key } });

            // 1. Gather System Info
            const platform = os.platform();
            const arch = os.arch();
            const release = os.release();
            const hostname = os.hostname();
            const cpus = os.cpus();
            const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown';

            // 2. Memory Info
            const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB';
            const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB';
            const processMem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB';

            // 3. Uptime
            const uptime = this.formatUptime(process.uptime());

            // 4. Contacts Loaded
            let contactCount = 0;
            try {
                if (fs.existsSync('./baileys_store.json')) {
                    const data = JSON.parse(fs.readFileSync('./baileys_store.json', 'utf-8'));
                    contactCount = Object.keys(data.contacts || {}).length;
                }
            } catch (e) { }

            // 5. Tech Stack
            const technologies = [
                'Node.js',
                'Baileys',
                'Sharp',
                'Canvas',
                'Puppeteer',
                'FFmpeg'
            ];

            // 6. Features Count
            let featuresCount = 0;
            try {
                const featuresDir = path.join(__dirname, '../features');
                const features = fs.readdirSync(featuresDir).filter(file => file.endsWith('.js') && file !== 'BaseFeature.js');
                featuresCount = features.length;
            } catch (e) { }

            // 7. Disk Usage
            let diskUsage = 'Unknown';
            try {
                // Get output of 'df -h /' and parse it
                const { stdout } = await execPromise('df -h /');
                const lines = stdout.trim().split('\n');
                if (lines.length > 1) {
                    // Filesystem      Size  Used Avail Use% Mounted on
                    // /dev/root        25G  1.2G   24G   5% /
                    const parts = lines[1].replace(/\s+/g, ' ').split(' ');
                    const size = parts[1];
                    const used = parts[2];
                    const usage = parts[4];
                    diskUsage = `${used} / ${size} (${usage})`;
                }
            } catch (e) {
                diskUsage = 'N/A';
            }

            // 8. ISP Info
            let ispName = 'Unknown';
            try {
                const response = await axios.get('http://ip-api.com/json', { timeout: 3000 });
                if (response.data && response.data.isp) {
                    ispName = response.data.isp;
                }
            } catch (e) {
                ispName = 'N/A';
            }

            const body = [
                '*Artifical Intelegent (fahmyzzx)*',
                'System Status & Statistics',
                '',
                '> *Environment*',
                `› *Platform:* ${platform} (${arch})`,
                `› *OS:* ${release}`,
                `› *Host:* ${hostname}`,
                `› *CPU:* ${cpuModel} (${cpus.length} Threads)`,
                `› *Disk:* ${diskUsage}`,
                `› *ISP:* ${ispName}`,
                '',
                '> *Bot Status*',
                `› *Node JS:* ${process.version}`,
                `› *Uptime:* ${uptime}`,
                `› *Memory Used:* ${processMem}`,
                `› *Total Memory:* ${totalMem} / ${freeMem}`,
                `› *Contacts:* ${contactCount} Loaded`,
                `› *Features:* ${featuresCount} Modules`,
                '',
                '> *Tech Stack*',
                ...technologies.map(t => `› ${t}`),
            ].join('\n');

            await sock.sendMessage(m.key.remoteJid, { react: { text: '', key: m.key } });

            await sock.sendMessage(m.key.remoteJid, {
                text: body,
                contextInfo: {
                    externalAdReply: {
                        title: 'System Statistics',
                        body: 'Real-time Bot Monitoring',
                        thumbnailUrl: this.bannerUrl,
                        sourceUrl: this.githubUrl,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        showAdAttribution: false
                    }
                }
            });

        } catch (error) {
            console.error('[STATS] error:', error);
            await sock.sendMessage(m.key.remoteJid, {
                text: '❌ Gagal mengambil statistik!'
            });
        }
    }

    formatUptime(seconds) {
        seconds = Number(seconds);
        var d = Math.floor(seconds / (3600 * 24));
        var h = Math.floor(seconds % (3600 * 24) / 3600);
        var m = Math.floor(seconds % 3600 / 60);
        var s = Math.floor(seconds % 60);

        var dDisplay = d > 0 ? d + (d == 1 ? "d " : "d ") : "";
        var hDisplay = h > 0 ? h + (h == 1 ? "h " : "h ") : "";
        var mDisplay = m > 0 ? m + (m == 1 ? "m " : "m ") : "";
        var sDisplay = s > 0 ? s + (s == 1 ? "s" : "s") : "";
        return (dDisplay + hDisplay + mDisplay + sDisplay).trim() || "0s";
    }
}

module.exports = StatsFeature;

const os = require('os');
const fs = require('fs');
const path = require('path');
const process = require('process');
const axios = require('axios');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class StatsFeature {
    constructor() {
        this.name = 'stats';
        this.description = '_Tampilkan statistik bot_';
        this.ownerOnly = true;
        this.bannerUrl = 'https://image.web.id/images/github-2.jpg';
        this.githubUrl = 'https://github.com/FAHMYZAR';
    }

    async execute(m, sock, parsed) {
            await sock.sendMessage(parsed.remoteJid, { react: { text: '📊', key: m.key } });

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
                const storePath = path.join(__dirname, '../baileys_store.json');
                if (fs.existsSync(storePath)) {
                    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
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
                const repoPath = path.join(__dirname, '..');
                const stat = fs.statfsSync(repoPath);
                const totalBytes = stat.blocks * stat.bsize;
                const freeBytes = stat.bavail * stat.bsize;
                const usedBytes = Math.max(totalBytes - freeBytes, 0);
                const usagePercent = totalBytes > 0 ? ((usedBytes / totalBytes) * 100).toFixed(0) : '0';
                const toGb = (value) => `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
                diskUsage = `${toGb(usedBytes)} / ${toGb(totalBytes)} (${usagePercent}%)`;
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

            const runtimeName = typeof Bun !== 'undefined' ? 'Bun' : 'Node.js';
            const runtimeVersion = typeof Bun !== 'undefined' ? Bun.version : process.version;

            const body = [
                Formatter.bold('Artificial Intelligence (fahmyzzx)'),
                'System Status & Statistics',
                `GitHub: ${this.githubUrl}`,
                Formatter.section('Environment'),
                `› ${Formatter.bold('Platform:')} ${platform} (${arch})`,
                `› ${Formatter.bold('OS:')} ${release}`,
                `› ${Formatter.bold('Host:')} ${hostname}`,
                `› ${Formatter.bold('CPU:')} ${cpuModel} (${cpus.length} Threads)`,
                `› ${Formatter.bold('Disk:')} ${diskUsage}`,
                `› ${Formatter.bold('ISP:')} ${ispName}`,

                Formatter.section('Bot Status'),
                `› ${Formatter.bold('Runtime:')} ${runtimeName} ${runtimeVersion}`,
                `› ${Formatter.bold('Uptime:')} ${uptime}`,
                `› ${Formatter.bold('Memory Used:')} ${processMem}`,
                `› ${Formatter.bold('Total Memory:')} ${totalMem} / ${freeMem}`,
                `› ${Formatter.bold('Contacts:')} ${contactCount} Loaded`,
                `› ${Formatter.bold('Features:')} ${featuresCount} Modules`,
                
                Formatter.section('Tech Stack'),
                ...technologies.map(t => `› ${t}`)
            ].join('\n');

            await sock.sendMessage(parsed.remoteJid, { react: { text: '', key: m.key } });

            await sock.sendMessage(parsed.remoteJid, {
                text: body
            });
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

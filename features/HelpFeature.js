const Helper = require('../utils/helper');
const config = require('../config/config');

class HelpFeature {
  constructor() {
    this.name = 'help';
    this.description = '_Tampilkan menu bantuan_';
    this.ownerOnly = false;
    this.bannerUrl = 'https://image.web.id/images/github-2.jpg';
    this.githubUrl = 'https://github.com/FAHMYZAR';
  }

  async execute(m, sock) {
    try {
      const features = Helper.loadFeatures();
      const sysInfo = Helper.getSystemInfo();

      const statusLines = [
        '*Status:* Online',
        `*Platform:* ${sysInfo.platform} ${sysInfo.arch}`,
        `*Node:* ${sysInfo.nodeVersion}`,
        `*Uptime:* ${Helper.formatUptime(sysInfo.uptime)}`,
        `*Memory:* ${sysInfo.memory.used}/${sysInfo.memory.total}`,
        `*CPU:* ${sysInfo.cpu.split(' ')[0]}`
      ];

      let ownerCommands = [];
      let userCommands = [];

      features.forEach((feature) => {
        const line = `\`${feature.ownerOnly ? config.ownerPrefix : config.userPrefix}${feature.name}\` — ${feature.description}`;
        if (feature.ownerOnly) {
          ownerCommands.push(line);
        } else {
          userCommands.push(line);
        }
      });

      const header = '*Artifical Intelegent (fahmyzzx)*';

      const body = [
        header,
        '',
        '> *System*',
        ...statusLines.map((t) => `› ${t}`),
        '',
        '> *Owner Commands*',
        ...(ownerCommands.length ? ownerCommands.map((t) => `${t}`) : ['Tidak ada']),
        '',
        '> *List Commands*',
        ...(userCommands.length ? userCommands.map((t) => `${t}`) : ['Tidak ada']),
        '',
        `> Total features: ${features.size}`,
        `> Prefix owner: ${config.ownerPrefix} | user: ${config.userPrefix}`
      ].join('\n');

      await sock.sendMessage(m.key.remoteJid, {
        text: body,
        contextInfo: {
          externalAdReply: {
            title: 'GitHub: fahmyzar',
            body: 'Pakai Sewajarnya saja yaa...',
            thumbnailUrl: this.bannerUrl,
            sourceUrl: this.githubUrl,
            mediaType: 1,
            renderLargerThumbnail: true,
            showAdAttribution: false
          }
        }
      });
    } catch (error) {
      await sock.sendMessage(m.key.remoteJid, {
        text: 'Terjadi kesalahan saat menampilkan bantuan.'
      });
      console.error('[HELP] error:', error.message);
    }
  }
}

module.exports = HelpFeature;
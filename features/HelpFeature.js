const Helper = require('../utils/helper');
const config = require('../config/config');
const Formatter = require('../utils/Formatter'); // Import Formatter

class HelpFeature {
  constructor() {
    this.name = 'help';
    this.description = '_Tampilkan menu bantuan_'; // Bisa di refactor pake Formatter nanti
    this.ownerOnly = false;
    this.bannerUrl = 'https://image.web.id/images/github-2.jpg';
    this.githubUrl = 'https://github.com/FAHMYZAR';
  }

  // Argument ke-3 sekarang 'parsed'
  async execute(m, sock, parsed) {
    const features = Helper.loadFeatures();
    const sysInfo = Helper.getSystemInfo();

    const statusLines = [
      `Platform: ${sysInfo.platform} ${sysInfo.arch}`,
      `Node: ${sysInfo.nodeVersion}`,
      `Uptime: ${Helper.formatUptime(sysInfo.uptime)}`,
      `Memory: ${sysInfo.memory.used}/${sysInfo.memory.total}`,
      `CPU: ${sysInfo.cpu.split(' ')[0]}`
    ].map(line => `› ${line}`); // Manual bullet

    let ownerCommands = [];
    let userCommands = [];

    features.forEach((feature) => {
      // Gunakan Formatter.code() untuk command biar rapi
      const cmd = Formatter.code(`${feature.ownerOnly ? config.ownerPrefix : config.userPrefix}${feature.name}`);
      const line = `${cmd} — ${feature.description}`;
      
      if (feature.ownerOnly) {
        ownerCommands.push(line);
      } else {
        userCommands.push(line);
      }
    });

    const header = Formatter.bold('Artificial Intelligence (fahmyzzx)');
    
    const body = [
      header,
      Formatter.section('System Status'),
      ...statusLines,
      
      Formatter.section('Owner Commands'),
      ...(ownerCommands.length ? ownerCommands : [Formatter.italic('Tidak ada')]),
      
      Formatter.section('User Commands'),
      ...(userCommands.length ? userCommands : [Formatter.italic('Tidak ada')]),
      
      '',
      Formatter.quote(`Total features: ${features.size}`),
      Formatter.quote(`Prefix: Owner ${Formatter.code(config.ownerPrefix)} | User ${Formatter.code(config.userPrefix)}`)
    ].join('\n');

    // Menggunakan parsed.remoteJid dari MessageParser
    await sock.sendMessage(parsed.remoteJid, {

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
  }
}

module.exports = HelpFeature;
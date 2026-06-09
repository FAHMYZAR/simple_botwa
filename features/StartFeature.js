const Helper = require('../utils/helper');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');

class StartFeature {
  constructor() {
    this.name = 'start';
    this.description = 'Menampilkan menu utama bot';
    this.ownerOnly = false;
    this.hidden = false;
  }

  async execute(m, sock, parsed) {
    const botname = 'Artificial Intelligence';
    const dev = 'fahmyzzx';
    const thumb = 'https://files.catbox.moe/z0g1hf.png';
    const tgram = 'https://github.com/FAHMYZAR';
    const nowa = 'github.com/FAHMYZAR';
    const footer = '©fahmyzzx';
    const prefix = config.userPrefix;
    const sender = parsed.sender;
    const sysInfo = Helper.getSystemInfo();
    const runtime = typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : `Node.js ${process.version}`;
    const features = Helper.loadFeatures();
    const totalFitur = Array.from(features.values()).filter(feature => !feature.hidden).length;

    const Intronya = [
      Formatter.bold('Artificial Intelligence (fahmyzzx)'),
      Formatter.section('System Status'),
      `› Platform: ${sysInfo.platform} ${sysInfo.arch}`,
      `› Runtime: ${runtime}`,
      `› Uptime: ${Helper.formatUptime(sysInfo.uptime)}`,
      `› Memory: ${sysInfo.memory.used}/${sysInfo.memory.total}`,
      `› Total Fitur: ${totalFitur}`
    ].join('\n');

    await sock.sendMessage(parsed.remoteJid, {
      interactiveMessage: {
        title: `${Intronya}\n`,
        footer: footer,
        thumbnail: thumb,
        mentions: [sender],
        contextInfo: {
          mentionedJid: [sender],
          isForwarded: true,
          forwardingScore: 250930,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363409851321325@newsletter',
            newsletterName: 'FAHMYZZX -REBORN',
            serverId: 999
          }
        },
        nativeFlowMessage: {
          messageParamsJson: JSON.stringify({
            limited_time_offer: {
              text: botname,
              url: tgram,
              copy_code: 'FhMyzZx',
              expiration_time: Date.now() * 999
            },
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1, 2, 3, 4, 5, 999],
              list_title: 'DAFTAR MENU',
              button_title: 'Daftar Menu'
            },
            tap_target_configuration: {
              title: '▸ G ◂',
              description: 'Glitches',
              canonical_url: tgram,
              domain: 'github.com',
              button_index: 0
            }
          }),
          buttons: [
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: 'Github',
                url: 'https://github.com/FAHMYZAR'
              })
            },
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: 'Portofolio',
                url: 'https://fahmyzzx.my.id'
              })
            },
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: 'CEO iCBear Space',
                url: 'https://icbear.space'
              })
            },
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: 'TikTok',
                url: 'https://tiktok.com/@icbear.space'
              })
            },
            {
              name: 'quick_reply',
              buttonParamsJson: JSON.stringify({
                display_text: 'Daftar Command',
                id: `${prefix}help`
              })
            }
          ]
        }
      }
    }, { quoted: m });
  }
}

module.exports = StartFeature;

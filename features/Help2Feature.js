const { generateWAMessageFromContent, proto, isJidGroup } = require('@whiskeysockets/baileys');
const Helper = require('../utils/helper');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const axios = require('axios');
const sharp = require('sharp');

class Help2Feature {
  constructor() {
    this.name = 'help2';
    this.description = '_Tampilkan menu bantuan dengan Interactive Buttons_';
    this.ownerOnly = false;
    this.githubUrl = 'https://github.com/FAHMYZAR';
  }

  async execute(m, sock, parsed) {
    const isGroup = isJidGroup(parsed.remoteJid);
    const features = Helper.loadFeatures();
    const sysInfo = Helper.getSystemInfo();

    let userCommands = [];
    let ownerCommands = [];

    features.forEach((feature) => {
      if (feature.hidden) return;
      const prefix = feature.ownerOnly ? config.ownerPrefix : config.userPrefix;
      const cmd = `${prefix}${feature.name}`;
      
      const row = { 
        id: cmd, 
        title: cmd, 
        description: feature.description.replace(/_/g, '').substring(0, 72)
      };

      if (feature.ownerOnly) {
        ownerCommands.push(row);
      } else {
        userCommands.push(row);
      }
    });

    const statusText = [
      Formatter.bold('Artificial Intelligence (fahmyzzx)'),
      Formatter.section('System Status'),
      `› Platform: ${sysInfo.platform} ${sysInfo.arch}`,
      `› Node: ${sysInfo.nodeVersion}`,
      `› Uptime: ${Helper.formatUptime(sysInfo.uptime)}`,
      `› Memory: ${sysInfo.memory.used}/${sysInfo.memory.total}`
    ].join('\n');

    // Download avatar GitHub agar ter-render sebagai jpegThumbnail lokasi
    let thumbBuffer = Buffer.from([]);
    try {
      const avatarUrl = 'https://github.com/FAHMYZAR.png';
      const response = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
      thumbBuffer = await sharp(Buffer.from(response.data))
        .resize(150, 150, { fit: 'cover' })
        .jpeg({ quality: 60 })
        .toBuffer();
    } catch (e) {
      console.error('Gagal mengambil avatar GitHub:', e.message);
    }

    const interactiveMessagePayload = {
      body: proto.Message.InteractiveMessage.Body.create({
        text: statusText
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: 'Daftar Perintah',
              sections: [
                {
                  title: 'User Commands',
                  rows: userCommands
                },
                {
                  title: 'Owner Commands',
                  rows: ownerCommands
                }
              ]
            })
          },
          {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: 'GitHub',
              url: this.githubUrl
            })
          }
        ]
      })
    };

    // Set header menggunakan lokasi (Alun-Alun Blora) dengan thumbnail GitHub
    interactiveMessagePayload.header = proto.Message.InteractiveMessage.Header.create({
      title: '',
      hasMediaAttachment: true,
      locationMessage: proto.Message.LocationMessage.create({
        degreesLatitude: -6.9691575,
        degreesLongitude: 111.4105055,
        name: "Alun-Alun Blora",
        address: "Blora, Jawa Tengah, Indonesia",
        jpegThumbnail: thumbBuffer
      })
    });

    const msg = generateWAMessageFromContent(parsed.remoteJid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.create(interactiveMessagePayload)
        }
      }
    }, { userJid: sock.user.id });

    const additionalNodes = [
      {
        tag: 'biz',
        attrs: {},
        content: [
          {
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [
              { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
            ]
          }
        ]
      }
    ];

    if (!isGroup) {
      additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    }

    await sock.relayMessage(parsed.remoteJid, msg.message, {
      messageId: msg.key.id,
      additionalNodes
    });
  }
}

module.exports = Help2Feature;

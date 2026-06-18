const fetchJadwalKuliah = require('../utils/KuliahHelper');
const config = require('../config/config');
const Formatter = require('../utils/Formatter');
const { generateWAMessageFromContent, proto } = require('@mataram/wa');

class AmbilKodeFeature {
  constructor() {
    this.name = 'ambilkode';
    this.description = 'Ambil kode presensi dari jadwal kuliah';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    try {
      let type = 'rpl';
      if (parsed.args.length > 0 && ['rpl', 'ds'].includes(parsed.args[0].toLowerCase())) {
        type = parsed.args[0].toLowerCase();
      }

      const data = await fetchJadwalKuliah(type);
      if (data.kuliah?.isHtml) {
        await sock.sendMessage(parsed.remoteJid, { text: `*Login Gagal!*\n\n${data.kuliah?.message}\n Server RAISING bermasalah` }, { quoted: m });
        return;
      }

      const kuliahList = Array.isArray(data.kuliah) ? data.kuliah : (data.kuliah.data || []);
      const today = new Date().getDay();
      const kuliahHariIni = kuliahList.filter(j => j.day_of_week_number == today);
      const uniqueKuliah = kuliahHariIni.filter((j, index, self) =>
        index === self.findIndex(k => k.nama_matakuliah === j.nama_matakuliah && k.jam_awal === j.jam_awal && k.nama_kelas === j.nama_kelas)
      );

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const todayName = days[today];
      const displayType = type === 'ds' ? 'DATA-SCIENCE' : type.toUpperCase();

      if (uniqueKuliah.length === 0) {
        await sock.sendMessage(parsed.remoteJid, { text: `*KODE PRESENSI ${displayType} ${todayName.toUpperCase()}*\n\n❌ Tidak ada jadwal kuliah hari ini!` }, { quoted: m });
        return;
      }

      let message = `*KODE PRESENSI ${displayType} ${todayName.toUpperCase()}*\n\n`;
      let hasCode = false;

      uniqueKuliah.forEach((jadwal) => {
        const kodePresensi = jadwal.kode || 'Belum dibuka';
        const namaMatkul = jadwal.nama_matakuliah || 'N/A';
        const kelas = jadwal.nama_kelas || '';
        message += `*${namaMatkul} (${kelas})*: ${Formatter.code(kodePresensi)}\n`;
        if (kodePresensi !== 'Belum dibuka') hasCode = true;
      });

      const lastKode = uniqueKuliah.filter(j => j.kode && j.kode !== 'Belum dibuka').pop()?.kode;

      if (hasCode) {
        message += '\n_*Klik tombol untuk copy kode terbaru*_';
      } else {
        message += '_Semua kode presensi belum dibuka_';
      }

      if (lastKode) {
        const interactiveMessagePayload = {
          body: proto.Message.InteractiveMessage.Body.create({ text: message }),
          footer: proto.Message.InteractiveMessage.Footer.create({ text: 'Artificial Intelligence' }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: [
              {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                  display_text: `Copy ${lastKode}`,
                  copy_code: lastKode
                })
              }
            ]
          })
        };

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

        const isGroup = parsed.remoteJid.endsWith('@g.us');
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

        // Disable biz_bot node injection that breaks iPhones if private
        // by NOT adding biz_bot here. (Help2Feature previously used it, but iPhone choked)

        await sock.relayMessage(parsed.remoteJid, msg.message, {
          messageId: msg.key.id,
          additionalNodes
        });
      } else {
        await sock.sendMessage(parsed.remoteJid, { text: message }, { quoted: m });
      }

    } catch (error) {
      console.error('AmbilKode error:', error);
      await sock.sendMessage(parsed.remoteJid, { text: `Terjadi kesalahan saat mengambil kode presensi!\n\nError: ${error.message}` }, { quoted: m });
    }
  }
}

module.exports = AmbilKodeFeature;

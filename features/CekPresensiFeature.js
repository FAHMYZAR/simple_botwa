const { cekPresensi } = require('../utils/PresensiHelper');
const Formatter = require('../utils/Formatter');

class CekPresensiFeature {
  constructor() {
    this.name = 'cekpresensi';
    this.description = 'Cek jadwal presensi hari ini';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    try {
      let nim, password = null;

      if (parsed.args.length > 0) {
        nim = parsed.args[0];
        if (parsed.args.length > 1) password = parsed.args[1];
      } else {
        await sock.sendMessage(parsed.remoteJid, { text: '❌ Masukkan NIM!\n\n*Contoh:*\n> `.cekpresensi 243200330`\n> `.cekpresensi 243200330 Pass243200330`' }, { quoted: m });
        return;
      }

      await sock.sendMessage(parsed.remoteJid, { text: '⏳ Mengecek presensi...' }, { quoted: m });

      const result = await cekPresensi(nim, password);

      if (!result || result.total === 0) {
        await sock.sendMessage(parsed.remoteJid, { text: '📋 *Ringkasan Presensi*\n\n✅ Tidak ada jadwal perkuliahan hari ini.' }, { quoted: m });
        return;
      }

      const todayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const todayName = todayNames[new Date().getDay()];
      const formatDate = (date) => {
        const pad = (n) => n.toString().padStart(2, '0');
        const d = new Date(date);
        return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} WIB`;
      };

      let message = `📋 *RINGKASAN PRESENSI - ${todayName.toUpperCase()}*\n`;
      message += `Nama: ${result.nama}\n`;
      message += `NIM: ${result.nim}\n\n`;
      message += `Sudah: ${result.sudah} | Belum: ${result.belum}\n\n`;
      result.list.forEach((item, i) => {
        const statusStr = item.status === 'sudah' ? '✅ Sudah' : '❌ Belum';
        message += `> _${i + 1}. ${item.matakuliah} (${item.kelas})_\n`;
        message += `   ${Formatter.code('Jam :')} ${item.jam}\n`;
        message += `   ${Formatter.code('Ruangan :')} ${item.ruang}\n`;
        message += `   ${Formatter.code('Status :')} ${statusStr}\n`;
        if (i < result.list.length - 1) message += '\n';
      });

      message += `\n_Update: ${formatDate(result.updatedAt)}_`;
      await sock.sendMessage(parsed.remoteJid, { text: message }, { quoted: m });

    } catch (error) {
      console.error('CekPresensi error:', error);
      await sock.sendMessage(parsed.remoteJid, { text: `❌ *Cek Presensi Gagal!*\n\n${error.message}\n\n💡 Pastikan NIM dan password benar.` }, { quoted: m });
    }
  }
}

module.exports = CekPresensiFeature;

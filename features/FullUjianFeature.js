const fetchJadwalKuliah = require('../utils/KuliahHelper');
const Formatter = require('../utils/Formatter');

class FullUjianFeature {
  constructor() {
    this.name = 'fullujian';
    this.description = 'Lihat semua jadwal ujian';
    this.ownerOnly = false;
  }

  formatDate(date) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date(date);
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  async execute(m, sock, parsed) {
    try {
      let type = 'rpl';
      if (parsed.args.length > 0 && ['rpl', 'ds'].includes(parsed.args[0].toLowerCase())) {
        type = parsed.args[0].toLowerCase();
      }

      const data = await fetchJadwalKuliah(type);
      if (data.ujian?.isHtml) {
        await sock.sendMessage(parsed.remoteJid, { text: `❌ *Login Gagal!*\n\n${data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah` }, { quoted: m });
        return;
      }

      const ujianList = Array.isArray(data.ujian) ? data.ujian : [];
      if (ujianList.length === 0) {
        await sock.sendMessage(parsed.remoteJid, { text: '📅 *JADWAL UJIAN*\n\n✅ Tidak ada jadwal ujian!' }, { quoted: m });
        return;
      }

      const groupedByDate = {};
      ujianList.forEach(u => {
        if (!groupedByDate[u.tanggal_ujian]) groupedByDate[u.tanggal_ujian] = [];
        groupedByDate[u.tanggal_ujian].push(u);
      });

      const sortedDates = Object.keys(groupedByDate).sort();
      let message = '📅 *JADWAL UJIAN LENGKAP*\n\n';

      sortedDates.forEach((date, dateIndex) => {
        message += `*${this.formatDate(date)}*\n`;
        groupedByDate[date].forEach((u, i) => {
          message += `> _${i + 1}. ${u.nama_matakuliah}_\n`;
          message += `   ${Formatter.code('Jam :')} ${u.waktu_ujian}\n`;
          message += `   ${Formatter.code('Kelas :')} ${u.nama_ruang}\n`;
          message += `   ${Formatter.code('Jenis :')} ${u.jenis_ujian}\n`;
          message += `   ${Formatter.code('Tipe :')} ${u.tipe_ujian}\n`;
          if (i < groupedByDate[date].length - 1) message += '\n';
        });
        if (dateIndex < sortedDates.length - 1) message += '\n\n';
      });

      await sock.sendMessage(parsed.remoteJid, { text: message }, { quoted: m });

    } catch (error) {
      console.error('FullUjian error:', error);
      await sock.sendMessage(parsed.remoteJid, { text: `❌ Terjadi kesalahan saat mengambil jadwal ujian!\n\nError: ${error.message}` }, { quoted: m });
    }
  }
}

module.exports = FullUjianFeature;

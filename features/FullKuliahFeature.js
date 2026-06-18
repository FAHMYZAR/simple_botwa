const fetchJadwalKuliah = require('../utils/KuliahHelper');
const Formatter = require('../utils/Formatter');

class FullKuliahFeature {
  constructor() {
    this.name = 'fullkuliah';
    this.description = 'Lihat semua jadwal kuliah & ujian minggu ini';
    this.ownerOnly = false;
  }

  removeGelar(nama) {
    if (!nama) return 'N/A';
    return nama.replace(/,?\s*(S\.Pd|S\.T|S\.Kom|S\.Si|S\.Sos|M\.Pd|M\.T|M\.Kom|M\.Si|Dr\.|Prof\.)/gi, '').replace(/\s+/g, ' ').trim();
  }

  formatDate(dateStr) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
  }

  async execute(m, sock, parsed) {
    try {
      let type = 'rpl';
      if (parsed.args.length > 0 && ['rpl', 'ds'].includes(parsed.args[0].toLowerCase())) {
        type = parsed.args[0].toLowerCase();
      }

      const data = await fetchJadwalKuliah(type);
      if (data.kuliah?.isHtml || data.ujian?.isHtml) {
        await sock.sendMessage(parsed.remoteJid, { text: `❌ *Login Gagal!*\n\n${data.kuliah?.message || data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah` }, { quoted: m });
        return;
      }

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const kuliahList = Array.isArray(data.kuliah) ? data.kuliah : (data.kuliah.data || []);
      const uniqueKuliah = kuliahList.filter((j, index, self) =>
        index === self.findIndex(k => k.nama_matakuliah === j.nama_matakuliah && k.jam_awal === j.jam_awal && k.day_of_week_number === j.day_of_week_number)
      );

      const kuliahByDay = {};
      uniqueKuliah.forEach(j => {
        const day = j.day_of_week_number;
        if (!kuliahByDay[day]) kuliahByDay[day] = [];
        kuliahByDay[day].push(j);
      });

      const ujianList = Array.isArray(data.ujian) ? data.ujian : (data.ujian.data || []);
      const displayType = type === 'ds' ? 'DATA-SCIENCE' : type.toUpperCase();
      let message = `📅 *JADWAL ${displayType} MINGGU INI*\n\n`;

      Object.keys(kuliahByDay).sort().forEach(day => {
        const dayName = days[day];
        const kuliah = kuliahByDay[day];
        const tanggal = kuliah[0]?.tanggal_pertemuan_presensi || '';
        const formattedDate = tanggal ? this.formatDate(tanggal) : '';

        message += `*${dayName.toUpperCase()}${formattedDate ? `, ${formattedDate}` : ''}*\n`;
        if (kuliah.length > 0) {
          message += '*Kuliah:*\n';
          kuliah.forEach((j, i) => {
            message += `> _${i + 1}. ${j.nama_matakuliah}_\n`;
            message += `   ${Formatter.code('Jam :')} ${j.jam_awal} - ${j.jam_akhir}\n`;
            message += `   ${Formatter.code('Kelas :')} ${j.nama_ruang} | ${j.nama_kelas}\n`;
            message += `   ${Formatter.code('Dosen :')} ${this.removeGelar(j.nama_dosen_pengampu_koordinator)}\n`;
            if (i < kuliah.length - 1) message += '\n';
          });
        }

        const ujianDay = ujianList.filter(u => u.tanggal_ujian === tanggal);
        if (ujianDay.length > 0) {
          message += '\n*Ujian:*\n';
          ujianDay.forEach((u, i) => {
            message += `> _${i + 1}. ${u.nama_matakuliah || u.matakuliah}_\n`;
            message += `   ${Formatter.code('Jam :')} ${u.jam_mulai} - ${u.jam_selesai}\n`;
            message += `   ${Formatter.code('Ruangan :')} ${u.ruangan || 'N/A'}\n`;
            message += `   ${Formatter.code('Jenis :')} ${u.jenis_ujian || 'Ujian'}\n`;
            if (i < ujianDay.length - 1) message += '\n';
          });
        }
        message += '\n';
      });

      const ujianOrphan = ujianList.filter(u => !Object.values(kuliahByDay).flat().some(k => k.tanggal_pertemuan_presensi === u.tanggal_ujian));
      if (ujianOrphan.length > 0) {
        message += '*UJIAN LAINNYA*\n';
        ujianOrphan.forEach((u, i) => {
          message += `> _${i + 1}. ${u.nama_matakuliah || u.matakuliah}_\n`;
          message += `   ${Formatter.code('Tanggal :')} ${u.tanggal_ujian}\n`;
          message += `   ${Formatter.code('Jam :')} ${u.jam_mulai} - ${u.jam_selesai}\n`;
          message += `   ${Formatter.code('Kelas :')} ${u.ruangan || 'N/A'}\n`;
          message += `   ${Formatter.code('Jenis :')} ${u.jenis_ujian || 'Ujian'}\n`;
          if (i < ujianOrphan.length - 1) message += '\n';
        });
      }

      await sock.sendMessage(parsed.remoteJid, { text: message }, { quoted: m });

    } catch (error) {
      console.error('FullKuliah error:', error);
      await sock.sendMessage(parsed.remoteJid, { text: `❌ Terjadi kesalahan saat mengambil jadwal!\n\nError: ${error.message}` }, { quoted: m });
    }
  }
}

module.exports = FullKuliahFeature;

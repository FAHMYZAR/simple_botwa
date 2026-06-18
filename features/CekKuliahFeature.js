const fetchJadwalKuliah = require('../utils/KuliahHelper');
const Formatter = require('../utils/Formatter');

class CekKuliahFeature {
  constructor() {
    this.name = 'cekkuliah';
    this.description = 'Cek jadwal kuliah hari ini atau hari tertentu';
    this.ownerOnly = false;
  }

  getDayNumber(dayName) {
    const days = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
    return days[dayName.toLowerCase()];
  }

  removeGelar(nama) {
    if (!nama) return 'N/A';
    return nama.replace(/,?\s*(S\.Pd|S\.T|S\.Kom|S\.Si|S\.Sos|M\.Pd|M\.T|M\.Kom|M\.Si|Dr\.|Prof\.)/gi, '').replace(/\s+/g, ' ').trim();
  }

  formatDate(date) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
    const d = new Date(date);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
  }

  async execute(m, sock, parsed) {
    try {
      let type = 'rpl';
      let dayArg = null;

      if (parsed.args.length > 0) {
        if (['rpl', 'ds'].includes(parsed.args[0].toLowerCase())) {
          type = parsed.args[0].toLowerCase();
          if (parsed.args.length > 1) dayArg = parsed.args[1];
        } else {
          dayArg = parsed.args[0];
        }
      }

      const data = await fetchJadwalKuliah(type);
      if (data.kuliah?.isHtml || data.ujian?.isHtml) {
        await sock.sendMessage(parsed.remoteJid, { text: `❌ *Login Gagal!*\n\n${data.kuliah?.message || data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah` }, { quoted: m });
        return;
      }

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const now = new Date();
      let targetDay, targetDayName;

      if (dayArg) {
        const dayNumber = this.getDayNumber(dayArg);
        if (dayNumber === undefined) {
          await sock.sendMessage(parsed.remoteJid, { text: '❌ Nama hari tidak valid!\n\nContoh:\n> .cekkuliah rpl senin\n> .cekkuliah ds jumat' }, { quoted: m });
          return;
        }
        targetDay = dayNumber;
        targetDayName = days[dayNumber];
      } else {
        targetDay = now.getDay();
        targetDayName = days[targetDay];
      }

      const todayDate = now.toISOString().split('T')[0];
      const kuliahList = Array.isArray(data.kuliah) ? data.kuliah : (data.kuliah.data || []);
      const uniqueKuliah = kuliahList.filter((j, index, self) =>
        index === self.findIndex(k => k.nama_matakuliah === j.nama_matakuliah && k.jam_awal === j.jam_awal && k.day_of_week_number === j.day_of_week_number)
      );
      const kuliahHariIni = uniqueKuliah.filter(j => j.day_of_week_number == targetDay);
      const jadwalDate = kuliahHariIni[0]?.tanggal_pertemuan_presensi || todayDate;
      const formattedDate = this.formatDate(jadwalDate);

      if (kuliahHariIni.length === 0) {
        await sock.sendMessage(parsed.remoteJid, { text: `📅 *JADWAL ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n✅ Tidak ada jadwal!` }, { quoted: m });
        return;
      }

      const displayType = type === 'ds' ? 'DATA-SCIENCE' : type.toUpperCase();
      let message = `📅 *JADWAL KULIAH ${displayType} - ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n`;

      kuliahHariIni.forEach((j, i) => {
        const tipe = j.tipe_pertemuan_presensi === 'T' ? 'Teori' : j.tipe_pertemuan_presensi === 'P' ? 'Praktikum' : j.tipe_pertemuan_presensi === 'Tt' ? 'Tutorial' : j.tipe_pertemuan_presensi === 'PIC' ? 'PIC' : 'N/A';
        message += `> _${i + 1}. ${j.nama_matakuliah}_\n`;
        message += `   ${Formatter.code('Jam :')} ${j.jam_awal} - ${j.jam_akhir}\n`;
        message += `   ${Formatter.code('Kelas :')} ${j.nama_ruang} | ${j.nama_kelas}\n`;
        message += `   ${Formatter.code('Ket :')} ${j.judul || 'N/A'}\n`;
        message += `   ${Formatter.code('Tipe :')} ${tipe}\n`;
        message += `   ${Formatter.code('Dosen :')} ${this.removeGelar(j.nama_dosen_pengampu_koordinator)}\n`;
        if (i < kuliahHariIni.length - 1) message += '\n';
      });

      await sock.sendMessage(parsed.remoteJid, { text: message }, { quoted: m });

    } catch (error) {
      console.error('CekKuliah error:', error);
      await sock.sendMessage(parsed.remoteJid, { text: `❌ Terjadi kesalahan saat mengambil jadwal!\n\nError: ${error.message}` }, { quoted: m });
    }
  }
}

module.exports = CekKuliahFeature;

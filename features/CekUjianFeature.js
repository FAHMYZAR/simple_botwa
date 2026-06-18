const fetchJadwalKuliah = require('../utils/KuliahHelper');
const Formatter = require('../utils/Formatter');

class CekUjianFeature {
  constructor() {
    this.name = 'cekujian';
    this.description = 'Cek jadwal ujian hari ini atau hari tertentu';
    this.ownerOnly = false;
  }

  getDayNumber(dayName) {
    const days = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6 };
    return days[dayName.toLowerCase()];
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
          dayArg = parsed.args[1] || null;
        } else {
          dayArg = parsed.args[0];
        }
      }

      const data = await fetchJadwalKuliah(type);
      if (data.ujian?.isHtml) {
        await sock.sendMessage(parsed.remoteJid, { text: `❌ *Login Gagal!*\n\n${data.ujian?.message}\n\nKemungkinan:\n• Session expired\n• Username/password salah\n• Server RAISING bermasalah` }, { quoted: m });
        return;
      }

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const now = new Date();
      let targetDay, targetDayName;
      if (dayArg) {
        const dayNumber = this.getDayNumber(dayArg);
        if (dayNumber === undefined) {
          await sock.sendMessage(parsed.remoteJid, { text: '❌ Nama hari tidak valid!\n\nContoh:\n> .cekujian rpl senin\n> .cekujian ds jumat' }, { quoted: m });
          return;
        }
        targetDay = dayNumber;
        targetDayName = days[dayNumber];
      } else {
        targetDay = now.getDay();
        targetDayName = days[targetDay];
      }

      const todayDate = now.toISOString().split('T')[0];
      const ujianList = Array.isArray(data.ujian) ? data.ujian : [];
      const targetDate = dayArg ? null : todayDate;
      const ujianHariIni = ujianList.filter(u => targetDate ? u.tanggal_ujian === targetDate : new Date(u.tanggal_ujian).getDay() === targetDay);
      const jadwalDate = ujianHariIni[0]?.tanggal_ujian || todayDate;
      const formattedDate = this.formatDate(jadwalDate);

      if (ujianHariIni.length === 0) {
        await sock.sendMessage(parsed.remoteJid, { text: `📅 *JADWAL UJIAN ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n✅ Tidak ada jadwal ujian!` }, { quoted: m });
        return;
      }

      let message = `📅 *JADWAL UJIAN ${targetDayName.toUpperCase()}, ${formattedDate}*\n\n`;
      ujianHariIni.forEach((u, i) => {
        message += `> _${i + 1}. ${u.nama_matakuliah}_\n`;
        message += `   ${Formatter.code('Jam :')} ${u.waktu_ujian}\n`;
        message += `   ${Formatter.code('Kelas :')} ${u.nama_ruang}\n`;
        message += `   ${Formatter.code('Jenis :')} ${u.jenis_ujian}\n`;
        message += `   ${Formatter.code('Tipe :')} ${u.tipe_ujian}\n`;
        if (i < ujianHariIni.length - 1) message += '\n';
      });

      await sock.sendMessage(parsed.remoteJid, { text: message }, { quoted: m });

    } catch (error) {
      console.error('CekUjian error:', error);
      await sock.sendMessage(parsed.remoteJid, { text: `❌ Terjadi kesalahan saat mengambil jadwal ujian!\n\nError: ${error.message}` }, { quoted: m });
    }
  }
}

module.exports = CekUjianFeature;

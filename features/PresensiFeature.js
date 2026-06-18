const { doPresensi } = require('../utils/PresensiHelper');

class PresensiFeature {
  constructor() {
    this.name = 'presensi';
    this.description = 'Presensi perkuliahan otomatis dengan kode presensi';
    this.ownerOnly = false;
  }

  async execute(m, sock, parsed) {
    try {
      if (parsed.args.length < 2) {
        await sock.sendMessage(parsed.remoteJid, { text: `❌ *Format salah!*\n\n*Penggunaan:*\n> .presensi <NIM> <Kode>\n\n*Contoh:*\n> .presensi 123456789 ABC123\n\n*Keterangan:*\n• NIM: Nomor Induk Mahasiswa\n• Kode: Kode presensi dari dosen` }, { quoted: m });
        return;
      }

      const [nim, kodePresensi] = parsed.args;

      if (!/^\d+$/.test(nim)) {
        await sock.sendMessage(parsed.remoteJid, { text: '❌ NIM harus berupa angka!' }, { quoted: m });
        return;
      }

      if (kodePresensi.length < 3) {
        await sock.sendMessage(parsed.remoteJid, { text: '❌ Kode presensi minimal 3 karakter!' }, { quoted: m });
        return;
      }

      await sock.sendMessage(parsed.remoteJid, { text: '⏳ Memproses presensi...' }, { quoted: m });

      const result = await doPresensi(nim, kodePresensi);

      if (result.status === 'success') {
        let response = `✅ ${result.message}\n\n`;
        response += `📚 *Matakuliah:* ${result.matakuliah}\n`;
        response += `📝 *Pertemuan:* ${result.pertemuan}`;
        await sock.sendMessage(parsed.remoteJid, { text: response }, { quoted: m });
      } else if (result.status === 'info') {
        await sock.sendMessage(parsed.remoteJid, { text: `ℹ️ ${result.message}` }, { quoted: m });
      } else {
        await sock.sendMessage(parsed.remoteJid, { text: `❌ ${result.message}` }, { quoted: m });
      }

    } catch (error) {
      console.error('[PRESENSI FEATURE ERROR]:', error);

      let errorMessage = '❌ *Terjadi Kesalahan!*\n\n';
      
      if (error.message.includes('Login gagal')) {
        errorMessage += '🔐 *Login Gagal!*\n\n';
        errorMessage += '💡 *Pastikan:*\n';
        errorMessage += '• NIM sudah benar\n';
        errorMessage += '• Password sudah benar\n';
        errorMessage += '• Akun RAISING aktif';
      } else if (error.message.includes('CSRF token')) {
        errorMessage += '🔒 *Token Security Bermasalah!*\n\n';
        errorMessage += '💡 *Coba beberapa saat lagi*';
      } else if (error.message.includes('ID mahasiswa')) {
        errorMessage += '🆔 *ID Mahasiswa Tidak Ditemukan!*\n\n';
        errorMessage += '💡 *Pastikan:*\n';
        errorMessage += '• Akun sudah terdaftar\n';
        errorMessage += '• Session valid';
      } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        errorMessage += '⏱️ *Koneksi Timeout!*\n\n';
        errorMessage += '💡 *Server RAISING lambat, coba lagi*';
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        errorMessage += '🌐 *Tidak Dapat Terhubung ke Server!*\n\n';
        errorMessage += '💡 *Pastikan:*\n';
        errorMessage += '• Koneksi internet stabil\n';
        errorMessage += '• DNS dapat resolve raising.almaata.ac.id';
      } else {
        errorMessage += `📋 *Detail:* ${error.message}\n\n`;
        errorMessage += '💡 *Coba beberapa saat lagi*';
      }

      await sock.sendMessage(parsed.remoteJid, { text: errorMessage }, { quoted: m });
    }
  }
}

module.exports = PresensiFeature;

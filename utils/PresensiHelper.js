const axios = require('axios');
const dns = require('dns');
const crypto = require('crypto');
const cheerio = require('cheerio');
const config = require('../config/config');

const BASE_URL = config.raising.baseUrl;

const customLookup = (hostname, options, callback) => {
  if (hostname === 'raising.almaata.ac.id') {
    callback(null, '103.189.245.24', 4);
  } else {
    dns.lookup(hostname, options, callback);
  }
};

async function login(nim, password) {
  try {
    let cookies = '';
    const session = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      lookup: customLookup,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });

    const welcomeResp = await session.get(`${BASE_URL}/welcome`);
    if (welcomeResp.headers['set-cookie']) {
      cookies = welcomeResp.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
    }

    const $ = cheerio.load(welcomeResp.data);
    const csrfToken = $('input[name="csrf_test_name"]').val();
    if (!csrfToken) throw new Error('CSRF token tidak ditemukan');

    const nimHash = crypto.createHash('md5').update(nim).digest('hex');
    const passHash = crypto.createHash('md5').update(password).digest('hex');
    const loginData = new URLSearchParams({
      csrf_test_name: csrfToken,
      f1: nimHash,
      f2: passHash,
      slogin: 'LOGIN'
    });

    const loginResp = await session.post(`${BASE_URL}/auth/login`, loginData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      maxRedirects: 5
    });

    const tokenMatch = loginResp.request?.responseURL?.match(/\/([a-f0-9]{40})\/dashboard/) || loginResp.request?.path?.match(/\/([a-f0-9]{40})\//);
    if (!tokenMatch) throw new Error('Login gagal! Periksa NIM dan password');

    const token = tokenMatch[1];
    if (loginResp.headers['set-cookie']) {
      const newCookies = loginResp.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
      cookies = `${cookies}; ${newCookies}`.split('; ').filter(c => c.trim()).join('; ');
    }

    let csrfCookieName = '';
    let ciSessionCookie = '';
    cookies.split('; ').forEach(cookie => {
      const [name, value] = cookie.split('=');
      if (name === 'csrf_cookie_name') csrfCookieName = value;
      if (name === 'ci_session') ciSessionCookie = value;
    });
    session.defaults.headers.Cookie = cookies;

    return { session, token, csrfCookieName, ciSessionCookie, cookies };
  } catch (error) {
    console.error('[LOGIN ERROR]:', error.message);
    throw new Error(`Login gagal: ${error.message}`);
  }
}

async function getIdMahasiswa(session, token) {
  try {
    const dashboardResp = await session.get(`${BASE_URL}/${token}/dashboard`, { maxRedirects: 5 });
    const htmlContent = dashboardResp.data;
    const matchId = htmlContent.match(/var\s+idmahasiswa\s*=\s*(\d+);?/i);
    const $ = cheerio.load(htmlContent);
    let nama = '';
    const nameCandidates = [$('.user-name').text(), $('h4.text-white').first().text(), $('.profile-user-name').text(), $('h3').first().text()];
    for (const cand of nameCandidates) {
      if (cand && cand.trim().length > 3) {
        nama = cand.trim();
        break;
      }
    }
    if (matchId && matchId[1]) return { id: matchId[1], nama: nama || 'Mahasiswa' };
    return null;
  } catch (error) {
    console.error('[GET ID ERROR]:', error.message);
    return null;
  }
}

async function getPresensiTersedia(session, token, nim) {
  try {
    const response = await session.get(`${BASE_URL}/${token}/api/perkuliahan/get_jadwal_kuliah_mahasiswa/${nim}`, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (response.data && response.data.status === 'success') {
      return response.data.data.filter(item => {
        const statusSplit = item.status_pertemuan ? item.status_pertemuan.split(':') : [];
        return !item.id_absensi_mahasiswa && statusSplit[1] === 'ongoing';
      });
    }
    return [];
  } catch (error) {
    console.error('[GET PRESENSI ERROR]:', error.message);
    throw new Error(`Gagal mendapatkan daftar presensi: ${error.message}`);
  }
}

async function submitPresensi(dataLogin, kodePresensi, idPertemuanPresensi) {
  try {
    const FormData = require('form-data');
    const absenPayload = new FormData();
    absenPayload.append('id_mahasiswa', dataLogin.idMahasiswa);
    absenPayload.append('kode_presensi', kodePresensi);

    const presensi = await dataLogin.session.post(
      `${BASE_URL}/${dataLogin.token}/api/perkuliahan/create_presensi_mahasiswa_by_kode/${idPertemuanPresensi}`,
      absenPayload,
      {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `csrf_cookie_name=${dataLogin.csrfCookieName}; ci_session=${dataLogin.ciSessionCookie}`,
          'Host': 'raising.almaata.ac.id',
          'Origin': BASE_URL,
          'Referer': `${BASE_URL}/`,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
        }
      }
    );

    if (presensi.data.status === 'success') {
      return { status: presensi.data.status, message: presensi.data.message, data: presensi.data.data };
    }
    return { status: presensi.data.status, message: presensi.data.message.charAt(0).toUpperCase() + presensi.data.message.slice(1), data: presensi.data.data };
  } catch (error) {
    console.error('[SUBMIT PRESENSI ERROR]:', error.message);
    throw new Error(`Gagal submit presensi: ${error.message}`);
  }
}

async function doPresensi(nim, kodePresensi) {
  let dataLogin;
  try {
    dataLogin = await login(nim, `Pass${nim}`);
  } catch (error) {
    dataLogin = await login(nim, nim);
  }

  const mahasiswaInfo = await getIdMahasiswa(dataLogin.session, dataLogin.token);
  if (!mahasiswaInfo?.id) throw new Error('ID mahasiswa tidak ditemukan');
  dataLogin.idMahasiswa = mahasiswaInfo.id;

  const presensiBelum = await getPresensiTersedia(dataLogin.session, dataLogin.token, nim);
  if (presensiBelum.length === 0) {
    return { status: 'info', message: '✅ Tidak ada presensi yang perlu diisi saat ini' };
  }

  const result = await submitPresensi(dataLogin, kodePresensi, presensiBelum[0].id_pertemuan_presensi);
  return {
    status: result.status,
    message: result.message,
    data: result.data,
    matakuliah: presensiBelum[0].nama_matakuliah || 'N/A',
    pertemuan: presensiBelum[0].pertemuan_ke || 'N/A'
  };
}

async function getJadwalPresensiHariIni(session, token, nim) {
  const response = await session.get(`${BASE_URL}/${token}/api/perkuliahan/get_jadwal_kuliah_mahasiswa/${nim}`, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });

  if (response.data && response.data.status === 'success') {
    const today = new Date().getDay();
    const listHariIni = response.data.data.filter(item => item.day_of_week_number == today);
    const uniqueList = listHariIni.filter((j, index, self) => index === self.findIndex(k => k.nama_matakuliah === j.nama_matakuliah && k.jam_awal === j.jam_awal && k.nama_kelas === j.nama_kelas));
    let sudahCount = 0;
    let belumCount = 0;
    const detailList = uniqueList.map(item => {
      const sudahAbsen = !!item.id_absensi_mahasiswa || item.status_presensi == '1';
      if (sudahAbsen) sudahCount++;
      else belumCount++;
      return {
        matakuliah: item.nama_matakuliah || 'N/A',
        kelas: item.nama_kelas || '',
        jam: `${item.jam_awal || 'N/A'} - ${item.jam_akhir || 'N/A'}`,
        status: sudahAbsen ? 'sudah' : 'belum',
        ruang: item.nama_ruang || 'N/A'
      };
    });
    return { total: uniqueList.length, sudah: sudahCount, belum: belumCount, list: detailList };
  }
  throw new Error('Gagal memproses respons server');
}

async function cekPresensi(nim, customPassword = null) {
  let dataLogin;
  if (customPassword) {
    dataLogin = await login(nim, customPassword);
  } else {
    try {
      dataLogin = await login(nim, `Pass${nim}`);
    } catch (error) {
      dataLogin = await login(nim, nim);
    }
  }

  const mahasiswaInfo = await getIdMahasiswa(dataLogin.session, dataLogin.token);
  if (!mahasiswaInfo?.id) throw new Error('ID mahasiswa tidak ditemukan');

  const result = await getJadwalPresensiHariIni(dataLogin.session, dataLogin.token, nim);
  return { ...result, nim, nama: mahasiswaInfo.nama, updatedAt: new Date() };
}

module.exports = { doPresensi, cekPresensi };

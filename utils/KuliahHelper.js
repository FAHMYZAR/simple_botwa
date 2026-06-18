const axios = require('axios');
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const crypto = require('crypto');
const config = require('../config/config');

const BASE_URL = config.raising.baseUrl;
const CACHE_DIR = path.join(__dirname, '../auth_info_baileys');
const SESSION_TTL = 2 * 60 * 60 * 1000;

const customLookup = (hostname, options, callback) => {
  if (hostname === 'raising.almaata.ac.id') {
    callback(null, '103.189.245.24', 4);
  } else {
    dns.lookup(hostname, options, callback);
  }
};

const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
};

const getAccount = (type) => {
  if (type === 'ds') {
    return {
      nim: config.raising.nim2,
      password: config.raising.password2,
      cacheFile: path.join(CACHE_DIR, 'session_raising_ds.json')
    };
  }

  return {
    nim: config.raising.nim,
    password: config.raising.password,
    cacheFile: path.join(CACHE_DIR, 'session_raising_rpl.json')
  };
};

const normalizeCookies = (cookies) => {
  if (!cookies) return '';
  return cookies.split('; ').filter(Boolean).join('; ');
};

const parseCookieMap = (cookies) => {
  const map = {};
  cookies.split('; ').forEach((cookie) => {
    const index = cookie.indexOf('=');
    if (index === -1) return;
    const name = cookie.slice(0, index);
    const value = cookie.slice(index + 1);
    map[name] = value;
  });
  return map;
};

const buildSession = (cookies) => axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': BASE_URL,
    'Cookie': cookies || ''
  },
  lookup: customLookup,
  family: 4,
  hints: dns.ADDRCONFIG | dns.V4MAPPED,
  validateStatus: (status) => status >= 200 && status < 400
});

const readCache = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!cached || !cached.token || !cached.cookies || !cached.expiresAt) return null;
    if (Date.now() > cached.expiresAt) return null;
    return cached;
  } catch {
    return null;
  }
};

const writeCache = (filePath, data) => {
  ensureCacheDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

async function login(nim, password, cacheFile) {
  const session = buildSession('');
  const welcomeResp = await session.get(`${BASE_URL}/welcome`);
  const welcomeCookies = Array.isArray(welcomeResp.headers['set-cookie'])
    ? welcomeResp.headers['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ')
    : '';
  const $ = cheerio.load(welcomeResp.data);
  const csrfToken = $('input[name="csrf_test_name"]').val();

  if (!csrfToken) {
    throw new Error('CSRF token tidak ditemukan');
  }

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
      'Cookie': welcomeCookies
    },
    maxRedirects: 5
  });

  const responseUrl = loginResp.request?.responseURL || loginResp.request?.path || '';
  const tokenMatch = responseUrl.match(/\/([a-f0-9]{40})\/dashboard/) || responseUrl.match(/\/([a-f0-9]{40})\//);
  if (!tokenMatch) {
    throw new Error('Login gagal');
  }

  const token = tokenMatch[1];
  const mergedCookies = normalizeCookies([
    welcomeCookies,
    Array.isArray(loginResp.headers['set-cookie'])
      ? loginResp.headers['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ')
      : ''
  ].filter(Boolean).join('; '));

  const cookies = normalizeCookies(mergedCookies);
  const cookieMap = parseCookieMap(cookies);
  const payload = {
    token,
    cookies,
    csrfCookieName: cookieMap.csrf_cookie_name || '',
    ciSessionCookie: cookieMap.ci_session || '',
    expiresAt: Date.now() + SESSION_TTL
  };

  writeCache(cacheFile, payload);
  return payload;
}

async function getSession(type = 'rpl') {
  const account = getAccount(type.toLowerCase());
  if (!account.nim || !account.password) {
    throw new Error(`RAISING credential belum diisi untuk ${type.toUpperCase()}`);
  }

  const cached = readCache(account.cacheFile);
  if (cached) {
    return { ...cached, cacheFile: account.cacheFile, nim: account.nim, password: account.password };
  }

  return { ...(await login(account.nim, account.password, account.cacheFile)), cacheFile: account.cacheFile, nim: account.nim, password: account.password };
}

async function fetchJadwalKuliah(type = 'rpl') {
  const accountType = type.toLowerCase() === 'ds' ? 'ds' : 'rpl';
  const account = getAccount(accountType);
  const sessionData = await getSession(accountType);
  const sess = buildSession(sessionData.cookies);

  const kuliahUrl = `${BASE_URL}/${sessionData.token}/api/perkuliahan/get_jadwal_kuliah_mahasiswa/${account.nim}/data`;
  const ujianUrl = `${BASE_URL}/${sessionData.token}/api/perkuliahan/get_jadwal_ujian_mahasiswa/${account.nim}/data`;

  try {
    const [kuliahResponse, ujianResponse] = await Promise.all([
      sess.get(kuliahUrl),
      sess.get(ujianUrl)
    ]);

    if (kuliahResponse.data?.status === 'success') {
      return {
        kuliah: kuliahResponse.data.data || [],
        ujian: ujianResponse.data?.data || []
      };
    }

    throw new Error('API response tidak valid');
  } catch (error) {
    const needsRelogin = error.code === 'ECONNABORTED' || error.response?.status >= 400 || typeof error.response?.data === 'string';
    if (needsRelogin) {
      const refreshed = await login(account.nim, account.password, account.cacheFile);
      const retrySession = buildSession(refreshed.cookies);
      const [kuliahResponse, ujianResponse] = await Promise.all([
        retrySession.get(kuliahUrl.replace(sessionData.token, refreshed.token)),
        retrySession.get(ujianUrl.replace(sessionData.token, refreshed.token))
      ]);

      if (kuliahResponse.data?.status === 'success') {
        return {
          kuliah: kuliahResponse.data.data || [],
          ujian: ujianResponse.data?.data || []
        };
      }
    }

    console.error('[FETCH ERROR]:', error);
    throw new Error(`Gagal fetch jadwal: ${error.message}`);
  }
}

module.exports = fetchJadwalKuliah;
module.exports.loginRaising = login;
module.exports.getRaisingSession = getSession;

let afkState = {
    isAfk: false,
    reason: '',
    since: 0
};

class AfkFeature {
    constructor() {
        this.name = 'afk';
        this.description = '_Mode AFK_';
        this.ownerOnly = true;
    }

    async execute(m, sock) {
        const jid = m.key.remoteJid;

        const body =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            '';

        // ===============================
        // PARSE COMMAND
        // ===============================
        const args = body.trim().split(/\s+/).slice(1);
        const sub = args.join(' ').trim();

        // ===============================
        // NONAKTIFKAN AFK
        // ===============================
        if (sub.toLowerCase() === 'off') {
            if (!afkState.isAfk) {
                return sock.sendMessage(jid, {
                    text: 'ℹ️ AFK sudah tidak aktif.'
                });
            }

            afkState.isAfk = false;

            const durMs = Date.now() - afkState.since;
            const menit = Math.max(1, Math.floor(durMs / 60000));

            return sock.sendMessage(jid, {
                text:
`👋 *AFK Dinonaktifkan*

Selamat datang kembali!
Kamu AFK selama ± ${menit} menit.

Siap online lagi 🚀`
            });
        }

        // ===============================
        // AKTIFKAN AFK
        // ===============================
        afkState = {
            isAfk: true,
            reason: sub || 'Lagi offline sebentar',
            since: Date.now()
        };

        return sock.sendMessage(jid, {
            text:
`✅ *AFK Aktif*

Halo semuanya 🙌  
Saat ini *Fahmy* sedang **offline (AFK)**.

📝 Alasan:
➜ ${afkState.reason}

Mohon ditunggu ya,
nanti kalau sudah online pasti dibalas 🙏

—
Pesan ini diatur manual via AFK System`
        });
    }
}

module.exports = AfkFeature;

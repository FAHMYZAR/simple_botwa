let afkState = {
    isAfk: false,
    reason: '',
    since: 0
};

class AfkFeatures {
    constructor() {
        this.name = 'afk';
        this.description = '_Auto Reply_';
        this.ownerOnly = false;
    }

    async execute(m, sock) {
        const jid = m.key.remoteJid;
        const isFromMe = m.key.fromMe;

        const body =
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            '';

        // ===============================
        // AKTIFKAN AFK
        // ===============================
        if (body.startsWith('.afk')) {
            const reason = body.replace('.afk', '').trim() || 'Lagi offline sebentar';

            afkState = {
                isAfk: true,
                reason,
                since: Date.now()
            };

            await sock.sendMessage(jid, {
                text:
`✅ *AFK Aktif*

Aku sekarang lagi *offline (AFK)* ya 🙏

📝 Alasan:
➜ ${reason}

Nanti kalau sudah online, AFK akan otomatis nonaktif 👌`
            });

            return;
        }

        // ===============================
        // JIKA OWNER KIRIM PESAN → NONAKTIFKAN AFK
        // ===============================
        if (isFromMe && afkState.isAfk) {
            afkState.isAfk = false;

            const durationMs = Date.now() - afkState.since;
            const minutes = Math.floor(durationMs / 60000);

            await sock.sendMessage(jid, {
                text:
`👋 *AFK Dimatikan*

Selamat datang kembali!
Kamu AFK selama ± ${minutes || 1} menit.

Siap online lagi 🚀`
            });

            return;
        }

        // ===============================
        // AUTO REPLY SAAT AFK
        // ===============================
        if (!isFromMe && afkState.isAfk) {
            await sock.sendMessage(jid, {
                text:
`Wa’alaikumsalam 🙏

Halo kak / gan / mas / mbak / bu 🙌  
Saat ini *Fahmy* sedang **offline (AFK)**.

📝 Alasan:
➜ ${afkState.reason}

Mohon ditunggu ya,
kalau sudah online nanti pasti dibalas 🙏

—  
Pesan ini dikirim otomatis oleh sistem AFK`
            });
        }
    }
}

module.exports = AfkFeatures;

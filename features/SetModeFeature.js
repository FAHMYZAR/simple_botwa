const fs = require('fs');
const path = require('path');

class SetModeFeature {
    constructor() {
        this.name = 'setbot';
        this.description = '_Mode (public/private)_';
        this.ownerOnly = true;
    }

    async execute(m, sock) {
        try {
            const args = m.message.conversation || m.message.extendedTextMessage?.text || '';
            const mode = args.split(' ')[1]?.toLowerCase();

            if (!mode || (mode !== 'public' && mode !== 'private')) {
                await sock.sendMessage(m.key.remoteJid, {
                    text: 'Format salah. Gunakan: &setbot public atau &setbot private'
                });
                return;
            }

            const settingsPath = path.join(__dirname, '../settings.json');
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

            settings.mode = mode;
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

            await sock.sendMessage(m.key.remoteJid, {
                text: `✅ Mode bot berhasil diubah ke: *${mode}*`
            });
            console.log(`[MODE] Switched to ${mode}`);

        } catch (error) {
            console.error('[SETBOT] Error:', error.message);
            await sock.sendMessage(m.key.remoteJid, {
                text: 'Gagal mengubah mode bot.'
            });
        }
    }
}

module.exports = SetModeFeature;

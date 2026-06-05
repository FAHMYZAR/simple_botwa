const fs = require('fs');
const path = require('path');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class SetModeFeature {
    constructor() {
        this.name = 'setbot';
        this.description = '_Mode (public/private)_';
        this.ownerOnly = true;
    }

    async execute(m, sock, parsed) {
        const mode = parsed.args[0]?.toLowerCase();

        if (!mode || (mode !== 'public' && mode !== 'private')) {
            throw new AppError(`Format salah.\nGunakan: ${Formatter.code('&setbot public')} atau ${Formatter.code('&setbot private')}`);
        }

        const settingsPath = path.join(__dirname, '../settings.json');
        
        let settings = { mode: 'public' };
        if (fs.existsSync(settingsPath)) {
             settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }

        settings.mode = mode;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        await sock.sendMessage(parsed.remoteJid, {
            text: `${Formatter.bold('✅ Mode bot berhasil diubah ke:')} ${Formatter.code(mode)}`
        });
        console.log(`[MODE] Switched to ${mode}`);
    }
}

module.exports = SetModeFeature;

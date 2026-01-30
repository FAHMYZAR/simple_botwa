const fs = require('fs');
const path = require('path');
const Formatter = require('../utils/Formatter');
const AppError = require('../utils/AppError');

class LogsFeature {
    constructor() {
        this.name = 'logs';
        this.description = '_Lihat logs terminal bot_';
        this.ownerOnly = true;
    }

    async execute(m, sock, parsed) {
        let lineCount = 5; // Default

        if (parsed.args[0] && !isNaN(parsed.args[0])) {
            lineCount = parseInt(parsed.args[0]);
        }

        const logPath = path.join(__dirname, '../bot_logs.txt');

        if (!fs.existsSync(logPath)) {
            throw new AppError('Belum ada file logs yang tersedia.');
        }

        const data = fs.readFileSync(logPath, 'utf-8');
        const lines = data.trim().split('\n');
        const lastLines = lines.slice(-lineCount);

        let formattedOutput = '';
        let lastDateStr = '';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (const line of lastLines) {
            // Match: [ISOString] LEVEL: Message
            const match = line.match(/^\[(.*?)\] (INFO|ERROR): (.*)$/);

            if (match) {
                const [_, timestamp, level, msg] = match;
                const date = new Date(timestamp);

                const day = date.getDate();
                const month = months[date.getMonth()];
                const year = date.getFullYear();
                const dateStr = `${day} ${month} ${year}`;

                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const timeStr = `${hours}:${minutes}`;

                if (dateStr !== lastDateStr) {
                    formattedOutput += `\n${Formatter.bold(dateStr)}\n`;
                    lastDateStr = dateStr;
                }

                formattedOutput += `(${timeStr}) ➝ ${msg}\n`;
            } else {
                // If line doesn't match format (legacy or other output), just append it
                formattedOutput += `${line}\n`;
            }
        }

        if (!formattedOutput) formattedOutput = 'Logs kosong.';

        await sock.sendMessage(parsed.remoteJid, {
            text: formattedOutput.trim()
        });
    }
}

module.exports = LogsFeature;

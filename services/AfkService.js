const fs = require('fs');
const path = require('path');

class AfkService {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.afkFile = path.join(this.dataDir, 'afk.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Initialize AFK file if not exists
    if (!fs.existsSync(this.afkFile)) {
      this._writeAfkData({ isAfk: false, reason: null, timestamp: null });
    }
  }

  /**
   * Read AFK data from file
   */
  _readAfkData() {
    try {
      const data = fs.readFileSync(this.afkFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[AfkService] Error reading AFK data:', error);
      return { isAfk: false, reason: null, timestamp: null };
    }
  }

  /**
   * Write AFK data to file
   */
  _writeAfkData(data) {
    try {
      fs.writeFileSync(this.afkFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[AfkService] Error writing AFK data:', error);
    }
  }

  /**
   * Check if bot is currently AFK
   */
  isAfkActive() {
    const data = this._readAfkData();
    return data.isAfk === true;
  }

  /**
   * Set bot as AFK
   */
  setAfk(reason = null) {
    const data = {
      isAfk: true,
      reason: reason || 'Sedang AFK',
      timestamp: Date.now()
    };
    this._writeAfkData(data);
    console.log('[AfkService] Bot is now AFK');
  }

  /**
   * Clear AFK status (bot is back)
   */
  clearAfk() {
    const currentData = this._readAfkData();
    if (!currentData.isAfk) return; // Already not AFK
    
    const data = {
      isAfk: false,
      reason: null,
      timestamp: null
    };
    this._writeAfkData(data);
    console.log('[AfkService] Bot is back from AFK');
  }

  /**
   * Get AFK info (reason and duration)
   */
  getAfkInfo() {
    const data = this._readAfkData();
    if (!data.isAfk) return null;
    
    const duration = Date.now() - data.timestamp;
    return {
      reason: data.reason,
      duration: this._formatDuration(duration)
    };
  }

  /**
   * Format duration to human readable
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} hari`;
    if (hours > 0) return `${hours} jam`;
    if (minutes > 0) return `${minutes} menit`;
    return `${seconds} detik`;
  }
}

module.exports = AfkService;

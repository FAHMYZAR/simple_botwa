class RateLimitService {
  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.limits = new Map();
    
    // Cleanup interval (every 10 minutes)
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Check if a user is rate limited
   * @param {string} key - Unique key (e.g., JID or IP)
   * @returns {bool} - True if allowed, False if limited
   */
  check(key) {
    const now = Date.now();
    let record = this.limits.get(key);

    if (!record) {
      record = { count: 1, resetAt: now + this.windowMs };
      this.limits.set(key, record);
      return true;
    }

    if (now > record.resetAt) {
      // Window expired, reset
      record.count = 1;
      record.resetAt = now + this.windowMs;
      return true;
    }

    if (record.count >= this.maxRequests) {
        return false;
    }

    record.count++;
    return true;
  }

  isLimited(key) {
    // Inverse of check, but doesn't increment. 
    // Usually we just want check() which does check-and-increment.
    // Let's rely on check() in usage.
    const record = this.limits.get(key);
    if (!record) return false;
    return Date.now() <= record.resetAt && record.count >= this.maxRequests;
  }
  
  cleanup() {
      const now = Date.now();
      for (const [key, record] of this.limits.entries()) {
          if (now > record.resetAt) {
              this.limits.delete(key);
          }
      }
  }
}

module.exports = RateLimitService;

require('dotenv').config();

module.exports = {
  ownerNumber: process.env.OWNER_NUMBER || '6285226166485',
  ownerPrefix: process.env.OWNER_PREFIX || '&',
  userPrefix: process.env.USER_PREFIX || '!',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    baseUrl: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/'
  }
};
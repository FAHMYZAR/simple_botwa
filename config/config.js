require('dotenv').config();

module.exports = {
  ownerNumber: process.env.OWNER_NUMBER || '6285226166485',
  ownerPrefix: process.env.OWNER_PREFIX || '&',
  userPrefix: process.env.USER_PREFIX || '!',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    baseUrl: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/'
  },
  aiFeature: {
    apiKey: process.env.AI_FEATURE_API_KEY,
    baseUrl: process.env.AI_FEATURE_API_URL || 'https://api.ferdev.my.id/ai/gptlogic'
  },
  stickerService: {
    telegram: {
      apiKey: process.env.TELEGRAM_STICKER_API_KEY,
      endpoint: process.env.TELEGRAM_STICKER_API_URL || 'https://api.ferdev.my.id/sticker/telestick'
    }
  },
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    model: process.env.MISTRAL_MODEL || 'mistral-large-latest'
  }
};
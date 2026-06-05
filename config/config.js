require('dotenv').config();

module.exports = {
  ownerNumber: process.env.OWNER_NUMBER || '6285226166485',
  ownerPrefix: process.env.OWNER_PREFIX || '&',
  userPrefix: process.env.USER_PREFIX || '!',
  ferdev: {
    apiKey: process.env.FERDEV_API_KEY,
    baseUrl: 'https://api.ferdev.my.id'
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
  },
  router: {
    apiKey: process.env.ROUTER_API_KEY,
    baseUrl: process.env.ROUTER_BASE_URL || 'https://9router.icbear.space',
    chatModel: process.env.ROUTER_CHAT_MODEL || 'vpscombo',
    queryModel: process.env.ROUTER_QUERY_MODEL || 'fastcombo'
  }
};
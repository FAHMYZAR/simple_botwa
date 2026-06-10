require('dotenv').config();

const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const defaultRouterBaseUrl = isProduction ? 'http://localhost:20128' : 'https://9router.icbear.space';
const routerBaseUrl = isProduction
  ? (process.env.ROUTER_PRODUCTION_BASE_URL || defaultRouterBaseUrl)
  : (process.env.ROUTER_BASE_URL || defaultRouterBaseUrl);

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
    baseUrl: routerBaseUrl,
    chatModel: process.env.ROUTER_CHAT_MODEL || 'vpscombo',
    queryModel: process.env.ROUTER_QUERY_MODEL || 'fastcombo'
  },
  googleAi: {
    apiKey: process.env.GOOGLE_AI_API_KEY,
    baseUrl: process.env.GOOGLE_AI_BASE_URL || 'https://googleai.minurulfalahsindangkarsa.com'
  },
  agnes: {
    apiKey: process.env.AGNES_API_KEY,
    baseUrl: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com',
    imageModel: process.env.AGNES_IMAGE_MODEL || 'agnes-image-2.0-flash',
    imageSize: process.env.AGNES_IMAGE_SIZE || '1024x1024'
  }
};
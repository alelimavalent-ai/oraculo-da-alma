// Carrega o .env e expõe a configuração de forma centralizada.
const path = require('path');
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'segredo-inseguro-troque-no-env',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || './data/oraculo.db',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  pixProviderKey: process.env.PIX_PROVIDER_KEY || '',

  // Integrações opcionais/futuras (somente via .env, nunca no código)
  astrologyApiKey: process.env.ASTROLOGY_API_KEY || '',
  asaas: {
    apiKey: process.env.ASAAS_API_KEY || '',
    baseUrl: process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3',
  },
  evolution: {
    url: process.env.EVOLUTION_API_URL || '',
    key: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.WHATSAPP_INSTANCE || '',
  },

  // Super Admin semeado automaticamente na subida do servidor.
  // Pode ser sobrescrito pelo .env; os valores abaixo são o padrão.
  superAdmin: {
    name: process.env.ADMIN_NAME || 'Alessandro Valentim',
    email: (process.env.ADMIN_EMAIL || 'alelimavalent@gmail.com').toLowerCase().trim(),
    password: process.env.ADMIN_PASSWORD || 'Alessandro@2026',
  },
};

// Avisos úteis ao subir o servidor, sem derrubar a aplicação.
if (config.jwtSecret === 'segredo-inseguro-troque-no-env') {
  console.warn('[AVISO] JWT_SECRET não configurado no .env — usando valor padrão inseguro. Defina antes de ir para produção.');
}

config.databaseAbsolutePath = path.isAbsolute(config.databaseUrl)
  ? config.databaseUrl
  : path.resolve(process.cwd(), config.databaseUrl);

module.exports = config;

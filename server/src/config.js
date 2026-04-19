import path from 'node:path';

const defaultDbPath = path.resolve(process.cwd(), 'data', 'app.db');
const defaultOpenRouterLogPath = path.resolve(process.cwd(), 'tmp', 'openrouter-api.log');

export const config = {
  port: Number.parseInt(process.env.PORT || '3001', 10),
  dbPath: process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : defaultDbPath,
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterLogPath: process.env.OPENROUTER_LOG_PATH
    ? path.resolve(process.cwd(), process.env.OPENROUTER_LOG_PATH)
    : defaultOpenRouterLogPath
};

export function assertConfig() {
  if (!config.jwtSecret || config.jwtSecret === 'change-me') {
    console.warn('JWT_SECRET is using the default insecure value. Set a strong secret before production use.');
  }
}

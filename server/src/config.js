import path from 'node:path';

const defaultDbPath = path.resolve(process.cwd(), 'data', 'app.db');

export const config = {
  port: Number.parseInt(process.env.PORT || '3001', 10),
  dbPath: process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : defaultDbPath,
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

export function assertConfig() {
  if (!config.jwtSecret || config.jwtSecret === 'change-me') {
    console.warn('JWT_SECRET is using the default insecure value. Set a strong secret before production use.');
  }
}

import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const ensureDirForFile = async (filePath) => {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
};

const serializeError = (error) => {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
};

export const maskApiKey = (apiKey = '') => {
  const value = String(apiKey || '').trim();
  if (!value) {
    return '';
  }

  if (value.length <= 10) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export const logOpenRouterEvent = async (event, payload = {}) => {
  try {
    await ensureDirForFile(config.openRouterLogPath);

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...payload,
      error: serializeError(payload.error)
    });

    await appendFile(config.openRouterLogPath, `${line}\n`, 'utf8');
  } catch (error) {
    console.error('[openrouter-log] Failed to write log:', error?.message || error);
  }
};

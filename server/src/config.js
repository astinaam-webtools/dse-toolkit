import path from 'node:path';

const defaultDbPath = path.resolve(process.cwd(), 'data', 'app.db');
const defaultOpenRouterLogPath = path.resolve(process.cwd(), 'tmp', 'openrouter-api.log');

export const config = {
  port: Number.parseInt(process.env.PORT || '3001', 10),
  dbPath: process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : defaultDbPath,
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  copilotSdkLogLevel: process.env.COPILOT_SDK_LOG_LEVEL || 'info',
  githubOauthClientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
  githubOauthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
  githubOauthRedirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI || '',
  githubOauthScopes: process.env.GITHUB_OAUTH_SCOPES || 'read:user read:org',
  githubOauthRequiredOrg: process.env.GITHUB_OAUTH_REQUIRED_ORG || '',
  githubOauthAuthorizeUrl: process.env.GITHUB_OAUTH_AUTHORIZE_URL || 'https://github.com/login/oauth/authorize',
  githubOauthTokenUrl: process.env.GITHUB_OAUTH_TOKEN_URL || 'https://github.com/login/oauth/access_token',
  githubOauthStateSecret: process.env.GITHUB_OAUTH_STATE_SECRET || process.env.JWT_SECRET || 'change-me',
  githubCopilotBaseUrl: process.env.GITHUB_COPILOT_BASE_URL || 'https://models.github.ai',
  githubCopilotApiKey: process.env.GITHUB_COPILOT_API_KEY || '',
  githubCopilotModel: process.env.GITHUB_COPILOT_MODEL || 'gpt-4o-mini',
  githubCopilotApiVersion: process.env.GITHUB_COPILOT_API_VERSION || '2026-03-10',
  githubCopilotOrg: process.env.GITHUB_COPILOT_ORG || '',
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

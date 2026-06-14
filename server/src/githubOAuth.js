import crypto from 'node:crypto';
import { config } from './config.js';

const DEFAULT_STATE_TTL_SECONDS = 600;

const base64url = (input) => Buffer.from(input).toString('base64url');

const fromBase64url = (input) => Buffer.from(String(input || ''), 'base64url').toString('utf8');

const signStatePayload = (payloadBase64) =>
  crypto
    .createHmac('sha256', config.githubOauthStateSecret)
    .update(payloadBase64)
    .digest('base64url');

export const createSignedOAuthState = ({ userId, ttlSeconds = DEFAULT_STATE_TTL_SECONDS }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: String(userId),
    iat: now,
    exp: now + ttlSeconds,
    nonce: crypto.randomBytes(12).toString('hex')
  };

  const payloadBase64 = base64url(JSON.stringify(payload));
  const signature = signStatePayload(payloadBase64);

  return `${payloadBase64}.${signature}`;
};

export const verifySignedOAuthState = (state) => {
  const raw = String(state || '');
  const [payloadBase64, signature] = raw.split('.');

  if (!payloadBase64 || !signature) {
    throw new Error('Invalid OAuth state payload.');
  }

  const expectedSignature = signStatePayload(payloadBase64);
  if (signature !== expectedSignature) {
    throw new Error('OAuth state signature mismatch.');
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64url(payloadBase64));
  } catch {
    throw new Error('OAuth state payload could not be parsed.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp || now > Number(payload.exp)) {
    throw new Error('OAuth state has expired.');
  }

  if (!payload?.userId) {
    throw new Error('OAuth state is missing userId.');
  }

  return {
    userId: String(payload.userId)
  };
};

export const buildGitHubOAuthAuthorizeUrl = ({ userId }) => {
  if (!config.githubOauthClientId || !config.githubOauthRedirectUri) {
    throw new Error('GitHub OAuth is not configured on the backend.');
  }

  const state = createSignedOAuthState({ userId: String(userId) });
  const url = new URL(config.githubOauthAuthorizeUrl);

  url.searchParams.set('client_id', config.githubOauthClientId);
  url.searchParams.set('redirect_uri', config.githubOauthRedirectUri);
  url.searchParams.set('scope', config.githubOauthScopes);
  url.searchParams.set('state', state);

  return {
    authorizeUrl: url.toString(),
    state
  };
};

export const exchangeGitHubOAuthCodeForToken = async ({ code }) => {
  if (!config.githubOauthClientId || !config.githubOauthClientSecret) {
    throw new Error('GitHub OAuth client credentials are not configured on the backend.');
  }

  const response = await fetch(config.githubOauthTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      client_id: config.githubOauthClientId,
      client_secret: config.githubOauthClientSecret,
      code,
      redirect_uri: config.githubOauthRedirectUri
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const message = payload.error_description || payload.error || 'Failed to exchange OAuth code for token.';
    throw new Error(message);
  }

  return {
    accessToken: String(payload.access_token || ''),
    tokenType: String(payload.token_type || 'bearer'),
    scope: String(payload.scope || ''),
    refreshToken: String(payload.refresh_token || ''),
    expiresIn: Number(payload.expires_in || 0),
    refreshTokenExpiresIn: Number(payload.refresh_token_expires_in || 0)
  };
};

const githubApiGet = async ({ token, path }) => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || `GitHub API request failed for ${path}.`;
    throw new Error(message);
  }

  return payload;
};

export const fetchGitHubUserProfile = async ({ token }) => {
  const profile = await githubApiGet({ token, path: '/user' });

  return {
    login: String(profile.login || ''),
    id: Number(profile.id || 0)
  };
};

export const verifyGitHubOrgMembership = async ({ token, requiredOrg }) => {
  if (!requiredOrg) {
    return true;
  }

  const orgs = await githubApiGet({ token, path: '/user/orgs' });
  return Array.isArray(orgs) && orgs.some((org) => String(org?.login || '').toLowerCase() === requiredOrg.toLowerCase());
};

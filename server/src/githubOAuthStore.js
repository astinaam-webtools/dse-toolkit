import { getDb } from './db.js';

const toIsoFromNow = (seconds) => {
  const ttl = Number(seconds || 0);
  if (!ttl || ttl <= 0) {
    return null;
  }

  return new Date(Date.now() + ttl * 1000).toISOString();
};

export const getUserGitHubOAuth = async (userId) => {
  const db = await getDb();
  return db.get(
    `SELECT user_id, provider, access_token, token_type, scope, refresh_token,
            expires_at, refresh_token_expires_at, github_login, github_id,
            created_at, updated_at
     FROM user_github_oauth
     WHERE user_id = ?`,
    userId
  );
};

export const saveUserGitHubOAuth = async ({
  userId,
  accessToken,
  tokenType,
  scope,
  refreshToken,
  expiresIn,
  refreshTokenExpiresIn,
  githubLogin,
  githubId
}) => {
  const now = new Date().toISOString();
  const db = await getDb();

  await db.run(
    `INSERT INTO user_github_oauth (
      user_id, provider, access_token, token_type, scope, refresh_token,
      expires_at, refresh_token_expires_at, github_login, github_id,
      created_at, updated_at
    )
    VALUES (?, 'github-oauth', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id)
    DO UPDATE SET
      provider = excluded.provider,
      access_token = excluded.access_token,
      token_type = excluded.token_type,
      scope = excluded.scope,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      refresh_token_expires_at = excluded.refresh_token_expires_at,
      github_login = excluded.github_login,
      github_id = excluded.github_id,
      updated_at = excluded.updated_at`,
    userId,
    accessToken,
    tokenType || 'bearer',
    scope || '',
    refreshToken || '',
    toIsoFromNow(expiresIn),
    toIsoFromNow(refreshTokenExpiresIn),
    githubLogin || '',
    githubId || null,
    now,
    now
  );

  return getUserGitHubOAuth(userId);
};

export const deleteUserGitHubOAuth = async (userId) => {
  const db = await getDb();
  await db.run('DELETE FROM user_github_oauth WHERE user_id = ?', userId);
};

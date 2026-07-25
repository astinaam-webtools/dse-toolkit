import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const FIXED_CONTEXT_MD = `# DSE Stock Market Analyst Assistant

You are an AI market analyst assistant specializing in the Dhaka Stock Exchange (DSE) and Bangladesh financial markets.

## Guidelines
1. Provide clear, objective, and analytical market insights based strictly on the user's prompt and conversation context.
2. Do not attempt to execute shell commands, read local system files, or probe server internals. Refuse system/shell access requests politely.
3. Disclaimer: Information provided is for educational and analytical purposes only and does not constitute financial advice or investment recommendations.
`;

/**
 * Ensures the target path is strictly contained within CURSOR_WORKSPACE_ROOT.
 */
function assertSafePath(targetPath) {
  const root = path.resolve(config.cursorWorkspaceRoot);
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Security Violation: Workspace path '${resolved}' is outside root '${root}'`);
  }
  return resolved;
}

/**
 * Prepares cwd and store directories for a given user and session.
 * Writes CONTEXT.md into cwd.
 */
export function ensureSession(userId, sessionId) {
  if (!userId || !sessionId) {
    throw new Error('userId and sessionId are required');
  }

  // Clean IDs to prevent path traversal
  const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSession = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');

  const sessionRoot = assertSafePath(path.join(config.cursorWorkspaceRoot, safeUser, safeSession));
  const cwd = assertSafePath(path.join(sessionRoot, 'cwd'));
  const storePath = assertSafePath(path.join(sessionRoot, 'store'));

  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(storePath, { recursive: true });

  const contextFile = path.join(cwd, 'CONTEXT.md');
  fs.writeFileSync(contextFile, FIXED_CONTEXT_MD, 'utf8');

  return {
    cwd,
    storePath,
    sessionRoot
  };
}

/**
 * Removes a specific session's directory tree under CURSOR_WORKSPACE_ROOT.
 */
export function resetSession(userId, sessionId) {
  if (!userId || !sessionId) return;
  const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSession = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');

  const sessionRoot = path.join(config.cursorWorkspaceRoot, safeUser, safeSession);
  try {
    const safePath = assertSafePath(sessionRoot);
    if (fs.existsSync(safePath)) {
      fs.rmSync(safePath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to reset session workspace [${userId}:${sessionId}]:`, err.message);
  }
}

/**
 * Removes all session workspace directories for a specific user under CURSOR_WORKSPACE_ROOT.
 */
export function resetAllSessions(userId) {
  if (!userId) return;
  const safeUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const userRoot = path.join(config.cursorWorkspaceRoot, safeUser);
  try {
    const safePath = assertSafePath(userRoot);
    if (fs.existsSync(safePath)) {
      fs.rmSync(safePath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to reset user workspace [${userId}]:`, err.message);
  }
}

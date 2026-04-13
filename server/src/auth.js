import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { getDb } from './db.js';

const TOKEN_TTL = '30d';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function createToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email }, config.jwtSecret, {
    expiresIn: TOKEN_TTL
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function sanitizeUser(user) {
  return {
    id: String(user.id),
    email: user.email
  };
}

export async function findUserByEmail(email) {
  const db = await getDb();
  return db.get('SELECT id, email, password_hash, created_at FROM users WHERE email = ?', normalizeEmail(email));
}

export async function findUserById(id) {
  const db = await getDb();
  return db.get('SELECT id, email, password_hash, created_at FROM users WHERE id = ?', id);
}

import jwt from 'jsonwebtoken';
import { UserRole } from '../models/User.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

const JWT_SECRET: string = process.env.JWT_SECRET || 'pharmacy_system_default_dev_secret_key_2026';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

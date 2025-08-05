import jwt from "jsonwebtoken";
import { JWTPayload } from "../types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

export function generateToken(
  payload: Omit<JWTPayload, "iat" | "exp">
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

export function refreshToken(token: string): string | null {
  try {
    const decoded = verifyToken(token);
    if (!decoded) return null;

    // Create new token with same payload (excluding iat and exp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iat, exp, ...payload } = decoded;
    return generateToken(payload);
  } catch {
    return null;
  }
}

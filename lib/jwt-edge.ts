import { SignJWT, jwtVerify } from "jose";
import { JWTPayload } from "../backend/types/auth";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const secret = new TextEncoder().encode(JWT_SECRET);

export async function verifyTokenEdge(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);

    return {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as "ADMIN" | "SUPER_ADMIN",
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    throw new Error(`Token verification failed: ${error}`);
  }
}

export async function generateTokenEdge(
  payload: Omit<JWTPayload, "iat" | "exp">
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);
}

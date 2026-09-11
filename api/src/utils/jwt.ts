import { sign, verify, SignOptions, VerifyOptions } from "jsonwebtoken";
import crypto from "crypto";

export interface JWTPayload {
  sub: string; // user id
  email: string;
  role: string; // Single role
  roles?: string[]; // Backward compat
  perms?: string[];
  iat?: number;
  exp?: number;
}

// Generate RSA keypair for JWT signing (or use HS256 with secret)
// For production, prefer RS256 with key rotation
const getJWTSecret = (): string => {
  return process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY || "default-secret-key-change-in-production";
};

const getJWTAlgorithm = (): "HS256" | "RS256" => {
  // If JWT_PRIVATE_KEY_PATH is set, use RS256, otherwise HS256
  return process.env.JWT_PRIVATE_KEY_PATH ? "RS256" : "HS256";
};

export const generateAccessToken = (payload: Omit<JWTPayload, "iat" | "exp">): string => {
  const expiresIn = (process.env.ACCESS_TOKEN_EXPIRY || "15m") as any;
  const algorithm = getJWTAlgorithm();

  const signOptions: SignOptions = {
    expiresIn,
    algorithm,
    issuer: process.env.JWT_ISSUER || "iris-api",
    audience: process.env.JWT_AUDIENCE || "iris-client",
  };

  return sign(payload, getJWTSecret(), signOptions);
};

export const verifyAccessToken = (token: string): JWTPayload => {
  const algorithm = getJWTAlgorithm();

  const verifyOptions: VerifyOptions = {
    algorithms: [algorithm],
    issuer: process.env.JWT_ISSUER || "iris-api",
    audience: process.env.JWT_AUDIENCE || "iris-client",
  };

  return verify(token, getJWTSecret(), verifyOptions) as JWTPayload;
};

export const generateRefreshToken = (): string => {
  // Generate a cryptographically random token
  return crypto.randomBytes(64).toString("hex");
};

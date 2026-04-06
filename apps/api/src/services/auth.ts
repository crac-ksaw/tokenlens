import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthClaims } from "./contracts.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(claims: AuthClaims, secret: string): string {
  return jwt.sign(claims, secret, { expiresIn: "7d" });
}

export function readBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length);
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply, secret: string): AuthClaims | null {
  const token = readBearerToken(request);
  if (!token) {
    reply.code(401).send({ message: "Missing bearer token" });
    return null;
  }

  try {
    return jwt.verify(token, secret) as AuthClaims;
  } catch {
    reply.code(401).send({ message: "Invalid token" });
    return null;
  }
}
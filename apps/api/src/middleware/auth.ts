import { FastifyRequest, FastifyReply } from "fastify";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

const PUBLIC_ROUTES = new Set([
  "GET /health",
  "GET /v1/corridors",
  "POST /v1/auth/login",
  "POST /v1/auth/challenge",
  "POST /travel-rule/incoming",
]);

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const routeKey = `${req.method} ${req.routerPath ?? req.url}`;
  if (PUBLIC_ROUTES.has(routeKey)) return;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "UNAUTHORIZED", message: "Bearer token required" });
  }
  try {
    const decoded = await req.jwtVerify<{
      institution_id: string;
      wallet_address: string;
      role: "admin" | "operator" | "viewer";
    }>();
    (req as any).institution = decoded;
  } catch {
    return reply.code(401).send({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
}

const challengeStore = new Map<string, { challenge: string; expiresAt: number }>();

export function generateChallenge(walletAddress: string): string {
  const challenge = `IroFi sign-in: ${walletAddress} @ ${Date.now()}`;
  challengeStore.set(walletAddress, { challenge, expiresAt: Date.now() + 5 * 60 * 1000 });
  return challenge;
}

export function verifyWalletSignature(walletAddress: string, signature: string): boolean {
  const stored = challengeStore.get(walletAddress);
  if (!stored || Date.now() > stored.expiresAt) return false;
  try {
    const messageBytes = new TextEncoder().encode(stored.challenge);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();
    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (valid) challengeStore.delete(walletAddress);
    return valid;
  } catch { return false; }
}
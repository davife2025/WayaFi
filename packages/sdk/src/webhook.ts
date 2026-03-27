/**
 * IroFi SDK — Webhook Verification Helper
 * Verifies incoming webhook signatures from IroFi.
 * Use this in your webhook handler to ensure authenticity.
 */
import { createHmac } from "crypto";

export type IroFiWebhookEvent =
  | "transfer.initiated"
  | "transfer.completed"
  | "transfer.failed"
  | "transfer.held"
  | "compliance.kyc_verified"
  | "compliance.hold"
  | "compliance.rejected"
  | "travel_rule.accepted"
  | "travel_rule.rejected";

export interface IroFiWebhookPayload<T = unknown> {
  event: IroFiWebhookEvent;
  data: T;
  timestamp: string;
}

/**
 * Verify an incoming IroFi webhook signature.
 * Compare the X-IroFi-Signature header against the expected HMAC.
 *
 * @example
 * app.post("/webhooks/irofi", (req, res) => {
 *   const signature = req.headers["x-irofi-signature"];
 *   const valid = verifyWebhookSignature(
 *     JSON.stringify(req.body),
 *     signature,
 *     process.env.IROFI_WEBHOOK_SECRET
 *   );
 *   if (!valid) return res.status(401).send("Invalid signature");
 *   // process event...
 * });
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Parse a raw webhook body into a typed IroFiWebhookPayload.
 */
export function parseWebhook<T = unknown>(rawBody: string): IroFiWebhookPayload<T> {
  return JSON.parse(rawBody) as IroFiWebhookPayload<T>;
}

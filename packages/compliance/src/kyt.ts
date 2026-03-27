export interface KYTScreeningRequest {
  tx_signature: string;
  sender_address: string;
  receiver_address: string;
  amount_usdc: number;
  corridor: string;
}
export interface KYTScreeningResult {
  approved: boolean;
  risk_score: number;
  flags: string[];
  provider_reference: string;
}
// Stub — implemented in Session 3
export async function screenTransaction(_req: KYTScreeningRequest): Promise<KYTScreeningResult> {
  throw new Error('KYT module not yet implemented — see Session 3');
}

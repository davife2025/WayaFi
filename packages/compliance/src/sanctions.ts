export interface SanctionsCheckRequest {
  wallet_address: string;
  entity_name?: string;
  jurisdiction: string;
}
export interface SanctionsCheckResult {
  is_sanctioned: boolean;
  matched_lists: string[];
  confidence: number;
}
// Stub — implemented in Session 3
export async function checkSanctions(_req: SanctionsCheckRequest): Promise<SanctionsCheckResult> {
  throw new Error('Sanctions module not yet implemented — see Session 3');
}

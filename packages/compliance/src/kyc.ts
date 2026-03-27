export interface KYCVerificationRequest {
  institution_id: string;
  wallet_address: string;
  jurisdiction: string;
  document_type: 'passport' | 'national_id' | 'business_registration';
  document_data: Record<string, unknown>;
}
export interface KYCVerificationResult {
  verified: boolean;
  risk_score: number;
  flags: string[];
  provider_reference: string;
}
// Stub — implemented in Session 3
export async function verifyKYC(_req: KYCVerificationRequest): Promise<KYCVerificationResult> {
  throw new Error('KYC module not yet implemented — see Session 3');
}

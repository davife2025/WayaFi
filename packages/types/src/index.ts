export type Corridor = 'NG_KE' | 'NG_ZA' | 'NG_GH' | 'KE_ZA' | 'KE_GH';
export type KYCStatus = 'unverified' | 'pending' | 'verified' | 'rejected' | 'suspended';
export type TransferStatus =
  | 'initiated' | 'kyc_check' | 'kyt_check' | 'travel_rule'
  | 'on_chain' | 'settling' | 'completed' | 'failed' | 'held';

export interface Institution {
  id: string;
  name: string;
  jurisdiction: string;
  vasp_did: string;
  kyc_status: KYCStatus;
  wallet_address: string;
  created_at: Date;
}

export interface TransferRequest {
  sender_institution_id: string;
  receiver_institution_id: string;
  amount_usdc: number;
  corridor: Corridor;
  memo?: string;
  idempotency_key: string;
}

export interface TransferRecord extends TransferRequest {
  id: string;
  status: TransferStatus;
  tx_signature?: string;
  travel_rule_envelope?: string;
  fee_usdc: number;
  fx_rate?: number;
  created_at: Date;
  updated_at: Date;
}

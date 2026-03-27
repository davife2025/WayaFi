-- IroFi Initial Schema Migration
-- Run with: pnpm drizzle-kit push

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  jurisdiction VARCHAR(2) NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  vasp_did TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected', 'suspended')),
  kyc_risk_score INTEGER CHECK (kyc_risk_score BETWEEN 0 AND 100),
  kyc_verified_at TIMESTAMPTZ,
  kyc_expires_at TIMESTAMPTZ,
  kyc_provider_reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key TEXT NOT NULL UNIQUE,
  sender_institution_id UUID NOT NULL REFERENCES institutions(id),
  receiver_institution_id UUID NOT NULL REFERENCES institutions(id),
  corridor VARCHAR(5) NOT NULL,
  amount_usdc REAL NOT NULL CHECK (amount_usdc > 0),
  fee_usdc REAL NOT NULL DEFAULT 0,
  net_amount_usdc REAL NOT NULL,
  fx_rate REAL,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','kyc_check','kyt_check','sanctions_check',
                      'aml_assessment','travel_rule','on_chain','settling',
                      'completed','failed','held')),
  tx_signature TEXT,
  settlement_pda TEXT,
  kyt_screening_id TEXT,
  kyt_risk_score REAL,
  kyt_approved BOOLEAN,
  sanctions_screening_id TEXT,
  aml_decision TEXT,
  aml_risk_score REAL,
  travel_rule_required BOOLEAN NOT NULL DEFAULT false,
  travel_rule_state TEXT,
  travel_rule_envelope_id TEXT,
  travel_rule_sunrise_exemption BOOLEAN DEFAULT false,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID REFERENCES transfers(id),
  institution_id UUID REFERENCES institutions(id),
  event_type TEXT NOT NULL,
  decision TEXT,
  risk_score REAL,
  flags JSONB,
  provider TEXT,
  provider_reference TEXT,
  requires_sar BOOLEAN DEFAULT false,
  requires_ctr BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id),
  transfer_id UUID REFERENCES transfers(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  delivered BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for compliance audit queries
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_corridor ON transfers(corridor);
CREATE INDEX idx_transfers_initiated_at ON transfers(initiated_at);
CREATE INDEX idx_transfers_sender ON transfers(sender_institution_id);
CREATE INDEX idx_compliance_events_transfer ON compliance_events(transfer_id);
CREATE INDEX idx_compliance_events_type ON compliance_events(event_type);
CREATE INDEX idx_webhook_deliveries_pending ON webhook_deliveries(delivered, next_retry_at)
  WHERE delivered = false;
/**
 * IroFi Database Schema — Drizzle ORM
 * PostgreSQL schema for all off-chain state: institutions, transfers, compliance records.
 */
import { pgTable, text, integer, boolean, timestamp, real, jsonb, uuid, varchar } from "drizzle-orm/pg-core";

export const institutions = pgTable("institutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  jurisdiction: varchar("jurisdiction", { length: 2 }).notNull(),
  wallet_address: text("wallet_address").notNull().unique(),
  vasp_did: text("vasp_did"),
  kyc_status: text("kyc_status").notNull().default("unverified"),
  kyc_risk_score: integer("kyc_risk_score"),
  kyc_verified_at: timestamp("kyc_verified_at"),
  kyc_expires_at: timestamp("kyc_expires_at"),
  kyc_provider_reference: text("kyc_provider_reference"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const transfers = pgTable("transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  idempotency_key: text("idempotency_key").notNull().unique(),
  sender_institution_id: uuid("sender_institution_id").notNull().references(() => institutions.id),
  receiver_institution_id: uuid("receiver_institution_id").notNull().references(() => institutions.id),
  corridor: varchar("corridor", { length: 5 }).notNull(),
  amount_usdc: real("amount_usdc").notNull(),
  fee_usdc: real("fee_usdc").notNull().default(0),
  net_amount_usdc: real("net_amount_usdc").notNull(),
  fx_rate: real("fx_rate"),
  memo: text("memo"),
  status: text("status").notNull().default("initiated"),
  // On-chain
  tx_signature: text("tx_signature"),
  settlement_pda: text("settlement_pda"),
  // Compliance
  kyt_screening_id: text("kyt_screening_id"),
  kyt_risk_score: real("kyt_risk_score"),
  kyt_approved: boolean("kyt_approved"),
  sanctions_screening_id: text("sanctions_screening_id"),
  aml_decision: text("aml_decision"),
  aml_risk_score: real("aml_risk_score"),
  // Travel Rule
  travel_rule_required: boolean("travel_rule_required").notNull().default(false),
  travel_rule_state: text("travel_rule_state"),
  travel_rule_envelope_id: text("travel_rule_envelope_id"),
  travel_rule_sunrise_exemption: boolean("travel_rule_sunrise_exemption").default(false),
  // Audit
  initiated_at: timestamp("initiated_at").notNull().defaultNow(),
  completed_at: timestamp("completed_at"),
  failed_at: timestamp("failed_at"),
  failure_reason: text("failure_reason"),
  metadata: jsonb("metadata"),
});

export const compliance_events = pgTable("compliance_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  transfer_id: uuid("transfer_id").references(() => transfers.id),
  institution_id: uuid("institution_id").references(() => institutions.id),
  event_type: text("event_type").notNull(),
  decision: text("decision"),
  risk_score: real("risk_score"),
  flags: jsonb("flags"),
  provider: text("provider"),
  provider_reference: text("provider_reference"),
  requires_sar: boolean("requires_sar").default(false),
  requires_ctr: boolean("requires_ctr").default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  institution_id: uuid("institution_id").notNull().references(() => institutions.id),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  secret: text("secret").notNull(),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const webhook_deliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhook_id: uuid("webhook_id").notNull().references(() => webhooks.id),
  transfer_id: uuid("transfer_id").references(() => transfers.id),
  event_type: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  status_code: integer("status_code"),
  delivered: boolean("delivered").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  next_retry_at: timestamp("next_retry_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});
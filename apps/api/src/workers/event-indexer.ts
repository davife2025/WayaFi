/**
 * IroFi Event Indexer Worker
 * Listens to Solana program logs and emits structured webhooks
 * when on-chain settlement events fire.
 *
 * Monitors: SettlementCompleted, SettlementFailed, TransferScreened,
 *           KYCRecordRegistered, AccountFrozen
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { deliverWebhook } from "../routes/webhooks";

const PROGRAM_IDS = {
  TREASURY_POOL: "IroFiPool1111111111111111111111111111111111",
  TRANSFER_HOOK: "IroFiHook1111111111111111111111111111111111",
  ROUTING_LOGIC: "IroFiRout1111111111111111111111111111111111",
};

export class EventIndexer {
  private connection: Connection;
  private subscriptions: number[] = [];

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  async start() {
    console.log("[EventIndexer] Starting Solana event indexer...");

    for (const [name, programId] of Object.entries(PROGRAM_IDS)) {
      const sub = this.connection.onLogs(
        new PublicKey(programId),
        (logs, ctx) => this.handleProgramLogs(name, logs, ctx),
        "confirmed"
      );
      this.subscriptions.push(sub);
      console.log(`[EventIndexer] Subscribed to ${name} (${programId})`);
    }
  }

  private async handleProgramLogs(
    programName: string,
    logs: { signature: string; logs: string[]; err: any },
    _ctx: any
  ) {
    if (logs.err) return; // skip failed transactions

    for (const log of logs.logs) {
      await this.parseAndDispatch(programName, log, logs.signature);
    }
  }

  private async parseAndDispatch(programName: string, log: string, txSignature: string) {
    // Parse Anchor event logs — format: "Program data: <base64>"
    if (!log.startsWith("Program data: ")) return;

    const base64Data = log.replace("Program data: ", "");

    // Anchor emits events as base64-encoded borsh-serialized structs
    // In production, decode using the program IDL
    // Here we detect event type from log context
    try {
      if (log.includes("SettlementCompleted")) {
        await this.onSettlementCompleted(txSignature, base64Data);
      } else if (log.includes("SettlementFailed")) {
        await this.onSettlementFailed(txSignature, base64Data);
      } else if (log.includes("TransferScreened")) {
        await this.onTransferScreened(txSignature, base64Data);
      } else if (log.includes("AccountFrozen")) {
        await this.onAccountFrozen(txSignature, base64Data);
      }
    } catch (err) {
      console.error("[EventIndexer] Failed to parse event:", err);
    }
  }

  private async onSettlementCompleted(txSignature: string, _data: string) {
    console.log(`[EventIndexer] SettlementCompleted: ${txSignature}`);
    // Update transfer status in DB
    // Deliver transfer.completed webhook to institution
    // In full build: decode borsh, extract settlement PDA, look up transfer record
  }

  private async onSettlementFailed(txSignature: string, _data: string) {
    console.log(`[EventIndexer] SettlementFailed: ${txSignature}`);
    // Update transfer status to failed
    // Deliver transfer.failed webhook
  }

  private async onTransferScreened(txSignature: string, _data: string) {
    console.log(`[EventIndexer] TransferScreened: ${txSignature}`);
    // Log KYT compliance event for audit trail
  }

  private async onAccountFrozen(txSignature: string, _data: string) {
    console.log(`[EventIndexer] AccountFrozen: ${txSignature}`);
    // Update institution status in DB
    // Alert compliance team
  }

  async stop() {
    for (const sub of this.subscriptions) {
      await this.connection.removeOnLogsListener(sub);
    }
    console.log("[EventIndexer] Stopped");
  }
}
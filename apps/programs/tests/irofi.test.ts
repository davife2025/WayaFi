import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("IroFi Programs — Integration Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load programs
  const tokenProgram = anchor.workspace.StablecoinToken as Program;
  const poolProgram = anchor.workspace.TreasuryPool as Program;
  const hookProgram = anchor.workspace.TransferHook as Program;
  const routingProgram = anchor.workspace.RoutingLogic as Program;

  const authority = (provider.wallet as anchor.Wallet).pacemaker;
  const mintKeypair = Keypair.generate();
  const institutionA = Keypair.generate(); // Lagos Bank
  const institutionB = Keypair.generate(); // Nairobi Bank

  const CORRIDOR_NG_KE = Buffer.from("NG_KE");

  it("Initializes treasury pool for NG→KE corridor", async () => {
    const [poolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), CORRIDOR_NG_KE],
      poolProgram.programId
    );

    await poolProgram.methods
      .initializePool(
        Array.from(CORRIDOR_NG_KE),
        new anchor.BN(1_000_000_000), // min liquidity: 1000 USDC
        50 // 0.5% fee
      )
      .accounts({ pool: poolPda })
      .rpc();

    const pool = await poolProgram.account.pool.fetch(poolPda);
    assert.equal(pool.isActive, true);
    assert.equal(pool.transferFeeBps, 50);
    console.log("✅ NG→KE pool initialized");
  });

  it("Registers KYC for Lagos Bank", async () => {
    const [kycPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("kyc"), institutionA.publicKey.toBuffer()],
      hookProgram.programId
    );

    const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year

    await hookProgram.methods
      .upsertKycRecord(
        true,         // verified
        Array.from(Buffer.from("NG")), // jurisdiction
        35,           // risk_score (moderate — grey listed)
        new anchor.BN(expiresAt),
        false         // not sanctioned
      )
      .accounts({
        kycRecord: kycPda,
        wallet: institutionA.publicKey,
      })
      .rpc();

    const record = await hookProgram.account.kyCEntry.fetch(kycPda);
    assert.equal(record.verified, true);
    assert.deepEqual(record.jurisdiction, Array.from(Buffer.from("NG")));
    console.log("✅ Lagos Bank KYC registered (NG, risk=35)");
  });

  it("Creates a transfer intent for $5000 USDC NG→KE", async () => {
    const idempotencyKey = Array.from(Keypair.generate().publicKey.toBytes());
    const [intentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("intent"), Buffer.from(idempotencyKey)],
      routingProgram.programId
    );

    await routingProgram.methods
      .createTransferIntent(
        new anchor.BN(5_000_000_000), // $5000 USDC (6 decimals)
        Array.from(CORRIDOR_NG_KE),
        new anchor.BN(1_310_000),     // FX rate 1.31
        idempotencyKey
      )
      .accounts({
        transferIntent: intentPda,
        initiator: institutionA.publicKey,
      })
      .signers([institutionA])
      .rpc();

    const intent = await routingProgram.account.transferIntent.fetch(intentPda);
    assert.equal(intent.amount.toString(), "5000000000");
    console.log("✅ $5000 transfer intent created for NG→KE");
  });

  it("Blocks transfer for unverified wallet", async () => {
    const unknownWallet = Keypair.generate();
    const idempotencyKey = Array.from(Keypair.generate().publicKey.toBytes());

    try {
      // This should fail — unknownWallet has no KYC record
      await routingProgram.methods
        .createTransferIntent(
          new anchor.BN(100_000_000),
          Array.from(CORRIDOR_NG_KE),
          new anchor.BN(1_310_000),
          idempotencyKey
        )
        .accounts({ initiator: unknownWallet.publicKey })
        .signers([unknownWallet])
        .rpc();
      assert.fail("Should have thrown");
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
      console.log("✅ Unverified wallet correctly blocked");
    }
  });
});

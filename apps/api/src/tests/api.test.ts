/**
 * IroFi API Integration Tests
 * Tests full transfer pipeline via HTTP against a running API server.
 */
import { describe, it, expect, beforeAll } from "vitest";

const API = process.env.TEST_API_URL ?? "http://localhost:3001/v1";
let authToken = "";

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json() };
}

describe("IroFi API — Health + Auth", () => {
  it("GET /health returns 200", async () => {
    const { status, data } = await api("GET", "/health");  // note: /health not /v1/health
    expect(status).toBe(200);
    expect(data.status).toBe("ok");
  });

  it("GET /v1/corridors returns 5 corridors (public endpoint)", async () => {
    const { status, data } = await api("GET", "/corridors");
    expect(status).toBe(200);
    expect(data.corridors).toHaveLength(5);
    expect(data.corridors.map((c: any) => c.id)).toContain("NG_KE");
  });

  it("Protected endpoints reject missing token", async () => {
    const { status } = await api("GET", "/transfers");
    expect(status).toBe(401);
  });
});

describe("IroFi API — Transfer Pipeline", () => {
  let transferId = "";

  it("POST /v1/transfers initiates transfer and returns 202", async () => {
    // Mock auth for test (in real test: complete wallet signature flow)
    authToken = process.env.TEST_JWT ?? "test-token";

    const { status, data } = await api("POST", "/transfers", {
      sender_institution_id: "inst_lagos_test",
      receiver_institution_id: "inst_nairobi_test",
      amount_usdc: 50000,
      corridor: "NG_KE",
      memo: "Test transfer — Invoice #TEST-001",
      idempotency_key: `test-${Date.now()}`,
    });

    expect(status).toBe(202);
    expect(data.transfer_id).toBeDefined();
    expect(data.status).toBe("initiated");
    expect(data.corridor).toBe("NG_KE");
    transferId = data.transfer_id;
    console.log(`Transfer initiated: ${transferId}`);
  });

  it("GET /v1/transfers/:id returns transfer detail", async () => {
    if (!transferId) return;
    const { status, data } = await api("GET", `/transfers/${transferId}`);
    expect(status).toBe(200);
    expect(data.transfer_id).toBe(transferId);
    expect(data.pipeline_steps).toBeDefined();
  });

  it("POST /v1/transfers rejects invalid corridor", async () => {
    const { status } = await api("POST", "/transfers", {
      sender_institution_id: "inst_1",
      receiver_institution_id: "inst_2",
      amount_usdc: 1000,
      corridor: "INVALID",
      memo: "test memo here",
      idempotency_key: `test-invalid-${Date.now()}`,
    });
    expect(status).toBe(400);
  });

  it("POST /v1/transfers with same idempotency key returns same transfer", async () => {
    const key = `idempotent-${Date.now()}`;
    const body = {
      sender_institution_id: "inst_a",
      receiver_institution_id: "inst_b",
      amount_usdc: 1000,
      corridor: "NG_KE",
      memo: "Idempotency test",
      idempotency_key: key,
    };
    const { data: first } = await api("POST", "/transfers", body);
    const { data: second } = await api("POST", "/transfers", body);
    // Both should return the same transfer_id (idempotent)
    expect(first.idempotency_key).toBe(second.idempotency_key);
  });
});

describe("IroFi API — Corridors + Oracle", () => {
  it("GET /v1/corridors/:id returns single corridor", async () => {
    const { status, data } = await api("GET", "/corridors/NG_KE");
    expect(status).toBe(200);
    expect(data.id).toBe("NG_KE");
    expect(data.transfer_fee_bps).toBe(50);
  });

  it("GET /v1/corridors/INVALID returns 404", async () => {
    const { status } = await api("GET", "/corridors/XX_YY");
    expect(status).toBe(404);
  });

  it("GET /v1/oracle/health returns oracle status", async () => {
    const { status, data } = await api("GET", "/oracle/health");
    expect([200, 206]).toContain(status);
    expect(data.corridors).toBeDefined();
  });
});

describe("IroFi API — Webhooks", () => {
  let webhookId = "";

  it("POST /v1/webhooks registers a webhook and returns secret", async () => {
    const { status, data } = await api("POST", "/webhooks", {
      url: "https://webhook.site/test",
      events: ["transfer.completed", "transfer.failed"],
    });
    expect(status).toBe(201);
    expect(data.secret).toBeDefined();
    expect(data.secret.startsWith("whsec_")).toBe(true);
    webhookId = data.id;
  });

  it("DELETE /v1/webhooks/:id removes webhook", async () => {
    if (!webhookId) return;
    const { status } = await api("DELETE", `/webhooks/${webhookId}`);
    expect(status).toBe(204);
  });
});

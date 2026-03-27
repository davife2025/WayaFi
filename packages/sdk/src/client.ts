export class StableHacksClient {
  constructor(private readonly apiUrl: string, private readonly apiKey: string) {}

  async initiateTreasuryTransfer(_params: unknown): Promise<unknown> {
    throw new Error('Not implemented until Session 5');
  }
  async checkComplianceStatus(_transferId: string): Promise<unknown> {
    throw new Error('Not implemented until Session 5');
  }
  async getCorridorLiquidity(_corridor: string): Promise<unknown> {
    throw new Error('Not implemented until Session 6');
  }
}

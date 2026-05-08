export type ProtocolEvent = {
  signature: string;
  timestamp: number;
  success: boolean;
  eventType: string;
  signer: string;
};

const INSTRUCTION_MAP: Record<string, string> = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  accrue_yield: 'Yield Accrual',
  trigger_credit_event: 'Credit Event',
  disburse_loan: 'Disbursement',
  repay_loan: 'Repayment',
  initialize_vault: 'Vault Init',
  initialize_loan: 'Loan Created',
  swap: 'AMM Swap',
  add_liquidity: 'Add Liquidity',
  remove_liquidity: 'Remove Liquidity',
};

function inferEventType(logs?: string[]): string {
  if (!logs) return 'Transaction';
  for (const line of logs) {
    const match = line.match(/Program log: Instruction: (\w+)/);
    if (match) {
      const key = match[1].toLowerCase();
      if (INSTRUCTION_MAP[key]) return INSTRUCTION_MAP[key];
    }
  }
  return 'Transaction';
}

type RawDuneTx = {
  address: string;
  block_time: number;
  block_slot: number;
  chain: string;
  raw_transaction: {
    transaction: {
      signatures: string[];
      message: {
        accountKeys: string[];
      };
    };
    meta: {
      status: { err: unknown };
      logMessages?: string[];
    };
  };
};

export async function fetchProtocolEvents(
  address: string,
  limit = 20,
): Promise<ProtocolEvent[]> {
  try {
    const res = await fetch(
      `/api/dune?endpoint=beta/svm/transactions/${address}&limit=${limit}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    const txs: RawDuneTx[] = data.transactions ?? [];
    return txs.map((tx) => ({
      // block_time from Dune SIM is in microseconds
      timestamp: Math.floor(tx.block_time / 1_000_000),
      signature: tx.raw_transaction.transaction.signatures[0] ?? '',
      success: tx.raw_transaction.meta.status.err === null,
      signer: tx.raw_transaction.transaction.message.accountKeys[0] ?? '',
      eventType: inferEventType(tx.raw_transaction.meta.logMessages),
    }));
  } catch {
    return [];
  }
}

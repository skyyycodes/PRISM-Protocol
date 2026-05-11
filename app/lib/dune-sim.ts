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
  limit = 50,
): Promise<ProtocolEvent[]> {
  try {
    // 1. Fetch from Dune SIM (Mainnet Target)
    const dunePromise = fetch(
      `/api/dune?endpoint=beta/svm/transactions/${address}&limit=${limit}`,
    ).then(res => res.ok ? res.json() : { transactions: [] })
     .then(data => {
        const txs: RawDuneTx[] = data.transactions ?? [];
        return txs.map((tx) => ({
          timestamp: Math.floor(tx.block_time / 1_000_000),
          signature: tx.raw_transaction.transaction.signatures[0] ?? '',
          success: tx.raw_transaction.meta.status.err === null,
          signer: tx.raw_transaction.transaction.message.accountKeys[0] ?? '',
          eventType: inferEventType(tx.raw_transaction.meta.logMessages),
        }));
     });

    // 2. Fetch from Local DB Indexer (Devnet/Testnet)
    // We add sync=true to trigger the on-chain crawler to update our DB with real transactions
    const localPromise = fetch(`/api/events?limit=${limit}&sync=true`)
      .then(res => res.ok ? res.json() : { events: [] })
      .then(data => data.events as ProtocolEvent[]);

    const [duneEvents, localEvents] = await Promise.all([dunePromise, localPromise]);

    // Merge and sort by timestamp
    const allEvents = [...localEvents, ...duneEvents];
    const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.signature, e])).values());
    
    return uniqueEvents
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  } catch (err) {
    console.error('Error fetching events:', err);
    return [];
  }
}

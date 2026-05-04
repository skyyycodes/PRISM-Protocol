'use client';

import { Keypair } from '@solana/web3.js';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import adminSecret from '@/contracts/keys/admin.json';
import borrowerSecret from '@/contracts/keys/borrower.json';
import juniorSecret from '@/contracts/keys/lpAlpha.json';
import seniorSecret from '@/contracts/keys/lpPrime.json';

export type Role = 'admin' | 'senior' | 'junior' | 'borrower';

export interface SimulationIdentity {
  role: Role;
  label: string;
  description: string;
  keypair: Keypair;
}

interface IdentityContextValue extends SimulationIdentity {
  identities: Record<Role, SimulationIdentity>;
  setRole: (role: Role) => void;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

function fromSecret(secret: number[]) {
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const identities = useMemo<Record<Role, SimulationIdentity>>(
    () => ({
      admin: {
        role: 'admin',
        label: 'Protocol Admin',
        description: 'Credit events, yield triggers, and setup controls',
        keypair: fromSecret(adminSecret as number[]),
      },
      senior: {
        role: 'senior',
        label: 'Prime Investor',
        description: 'Prime tranche capital with priority protection',
        keypair: fromSecret(seniorSecret as number[]),
      },
      junior: {
        role: 'junior',
        label: 'Alpha Investor',
        description: 'Alpha tranche first-loss capital and upside',
        keypair: fromSecret(juniorSecret as number[]),
      },
      borrower: {
        role: 'borrower',
        label: 'Borrower',
        description: 'Receives deployed capital and repays cashflows',
        keypair: fromSecret(borrowerSecret as number[]),
      },
    }),
    [],
  );
  const [role, setRole] = useState<Role>('admin');

  return (
    <IdentityContext.Provider value={{ ...identities[role], identities, setRole }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const value = useContext(IdentityContext);
  if (!value) {
    throw new Error('useIdentity must be used inside IdentityProvider');
  }
  return value;
}

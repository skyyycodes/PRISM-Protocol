'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  role: string;
  signature?: string;
  deltas: Record<string, { before: string; after: string; delta: string }>;
  navSnapshot: string;
  status: 'success' | 'error' | 'info';
  message?: string;
}

interface SimulationLogContextValue {
  entries: LogEntry[];
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

const STORAGE_KEY = 'prism-simulation-log-v1';
const SimulationLogContext = createContext<SimulationLogContextValue | null>(null);

export function SimulationLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setEntries(JSON.parse(saved) as LogEntry[]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 100)));
  }, [entries]);

  const addEntry = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    setEntries((current) => [
      {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
      ...current,
    ]);
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return (
    <SimulationLogContext.Provider value={{ entries, addEntry, clear }}>
      {children}
    </SimulationLogContext.Provider>
  );
}

export function useSimulationLog() {
  const value = useContext(SimulationLogContext);
  if (!value) {
    throw new Error('useSimulationLog must be used inside SimulationLogProvider');
  }
  return value;
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/lib/navigation';

export interface BudgetForImport {
  id: string;
  name: string;
  custoTotal: number;
  precoVenda: number;
  pesoPeca: number;
  tempoImpressao: number;
}

export type PriceField = 'custoTotal' | 'precoVenda';

export interface ImportData extends BudgetForImport {
  marketplace: string;
  priceField: PriceField;
}

const STORAGE_KEY = 'maker3d_import_budget';

export function useImportToMarketplace() {
  const router = useRouter();

  const importToMarketplace = (budget: BudgetForImport, marketplace: 'shopee' | 'tiktok' | 'mercadolivre', priceField: PriceField = 'custoTotal') => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...budget,
      marketplace,
      priceField,
    }));
    router.push(`/dashboard/marketplace/${marketplace}`);
  };

  return { importToMarketplace };
}

export function useImportFromCalculator() {
  const [importedData, setImportedData] = useState<ImportData | null>(null);
  const [budgets, setBudgets] = useState<BudgetForImport[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setImportedData(data);
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, []);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/budgets');
      if (res.ok) {
        const data = await res.json();
        setBudgets((data ?? []).map((b: any) => ({
          id: b.id,
          name: b.name,
          custoTotal: b.custoTotal,
          precoVenda: b.precoVenda,
          pesoPeca: b.pesoPeca,
          tempoImpressao: b.tempoImpressao,
        })));
      }
    } catch {}
    setLoading(false);
  }, []);

  const clearImported = useCallback(() => {
    setImportedData(null);
  }, []);

  const selectBudget = useCallback((budget: BudgetForImport, priceField: PriceField) => {
    setImportedData({ ...budget, marketplace: '', priceField });
    setDialogOpen(false);
  }, []);

  return {
    importedData,
    budgets,
    loading,
    dialogOpen,
    setDialogOpen,
    fetchBudgets,
    clearImported,
    selectBudget,
  };
}
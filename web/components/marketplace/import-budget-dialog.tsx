'use client';

import { useEffect } from 'react';
import { DollarSign, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useImportFromCalculator, type BudgetForImport, type PriceField } from '@/hooks/use-import-budget';

function fmt(v: number | null | undefined): string {
  return `R$ ${(v ?? 0)?.toFixed?.(2)?.replace?.('.', ',') ?? '0,00'}`;
}

interface ImportBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (budget: BudgetForImport, priceField: PriceField) => void;
}

export function ImportBudgetDialog({ open, onOpenChange, onSelect }: ImportBudgetDialogProps) {
  const { budgets, loading, fetchBudgets } = useImportFromCalculator();

  useEffect(() => {
    if (open) {
      fetchBudgets();
    }
  }, [open, fetchBudgets]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[hsl(0,0%,4%)] border-white/10 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Importar da Calculadora 3D</DialogTitle>
          <DialogDescription className="text-white/40">
            Escolha um orçamento e selecione qual valor usar como custo do produto.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-10">
            <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Nenhum orçamento 3D salvo encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {budgets.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-lg bg-white/[0.03] border border-white/5 space-y-3"
              >
                <h4 className="text-white font-medium text-sm truncate">{b.name}</h4>
                <div className="flex flex-wrap gap-3 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Custo Total: <strong className="text-white/60">{fmt(b.custoTotal)}</strong>
                  </span>
                  <span className="flex items-center gap-1 text-gold">
                    <DollarSign className="w-3 h-3" />
                    Preço de Venda: <strong className="text-gold">{fmt(b.precoVenda)}</strong>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelect(b, 'custoTotal')}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Usar Custo Total
                  </button>
                  <button
                    onClick={() => onSelect(b, 'precoVenda')}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-all"
                  >
                    Usar Preço de Venda
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
'use client';

import { useState } from 'react';
import { DollarSign, ShoppingBag, Store } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { type BudgetForImport, type PriceField } from '@/hooks/use-import-budget';

function fmt(v: number | null | undefined): string {
  return `R$ ${(v ?? 0)?.toFixed?.(2)?.replace?.('.', ',') ?? '0,00'}`;
}

type Marketplace = 'shopee' | 'tiktok' | 'mercadolivre';

interface MarketplacePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetForImport | null;
  onSelect: (marketplace: Marketplace, priceField: PriceField) => void;
}

export function MarketplacePriceDialog({ open, onOpenChange, budget, onSelect }: MarketplacePriceDialogProps) {
  const [step, setStep] = useState<'marketplace' | 'price'>('marketplace');
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace | null>(null);

  const handleMarketplaceSelect = (marketplace: Marketplace) => {
    setSelectedMarketplace(marketplace);
    setStep('price');
  };

  const handlePriceSelect = (priceField: PriceField) => {
    if (selectedMarketplace) {
      onSelect(selectedMarketplace, priceField);
      handleClose();
    }
  };

  const handleClose = () => {
    setStep('marketplace');
    setSelectedMarketplace(null);
    onOpenChange(false);
  };

  if (!budget) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[hsl(0,0%,4%)] border-white/10 max-w-md">
        {step === 'marketplace' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Enviar para Marketplace</DialogTitle>
              <DialogDescription className="text-white/40">
                Escolha o marketplace para o orçamento "{budget.name}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              <p className="text-xs text-white/30 mb-2">
                Custo Total: <strong className="text-white/60">{fmt(budget.custoTotal)}</strong> · Preço de Venda: <strong className="text-gold">{fmt(budget.precoVenda)}</strong>
              </p>
              <button
                onClick={() => handleMarketplaceSelect('shopee')}
                className="w-full p-4 rounded-lg bg-white/[0.03] border border-white/5 hover:border-[#EE4D2D]/30 hover:bg-[#EE4D2D]/5 transition-all flex items-center gap-3"
              >
                <ShoppingBag className="w-5 h-5 text-[#EE4D2D]" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Shopee</p>
                  <p className="text-xs text-white/40">Calculadora de precificação Shopee</p>
                </div>
              </button>
              <button
                onClick={() => handleMarketplaceSelect('tiktok')}
                className="w-full p-4 rounded-lg bg-white/[0.03] border border-white/5 hover:border-[#00f2ea]/30 hover:bg-[#00f2ea]/5 transition-all flex items-center gap-3"
              >
                <Store className="w-5 h-5 text-[#00f2ea]" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">TikTok Shop</p>
                  <p className="text-xs text-white/40">Calculadora de precificação TikTok Shop</p>
                </div>
              </button>
              <button
                onClick={() => handleMarketplaceSelect('mercadolivre')}
                className="w-full p-4 rounded-lg bg-white/[0.03] border border-white/5 hover:border-[#FFE600]/30 hover:bg-[#FFE600]/5 transition-all flex items-center gap-3"
              >
                <ShoppingBag className="w-5 h-5 text-[#FFE600]" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Mercado Livre</p>
                  <p className="text-xs text-white/40">Calculadora de precificação Mercado Livre</p>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Qual valor usar como custo?</DialogTitle>
              <DialogDescription className="text-white/40">
                O custo do produto na calculadora será preenchido com o valor escolhido.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5 mb-3">
                <p className="text-sm text-white/70 font-medium truncate">{budget.name}</p>
              </div>
              <button
                onClick={() => handlePriceSelect('custoTotal')}
                className="w-full p-4 rounded-lg bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Custo Total</p>
                    <p className="text-xs text-white/40">Custo de produção da peça 3D</p>
                    <p className="text-lg font-bold text-white/80 font-mono mt-1">{fmt(budget.custoTotal)}</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handlePriceSelect('precoVenda')}
                className="w-full p-4 rounded-lg bg-gold/5 border border-gold/20 text-left hover:bg-gold/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gold">Preço de Venda Sugerido</p>
                    <p className="text-xs text-white/40">Valor de venda já com margem de lucro</p>
                    <p className="text-lg font-bold text-gold font-mono mt-1">{fmt(budget.precoVenda)}</p>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
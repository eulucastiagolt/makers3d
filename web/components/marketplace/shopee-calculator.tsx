'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, DollarSign, Receipt, Percent, TrendingUp, Loader2, Save, Info, Package, ArrowDownToLine, Truck } from 'lucide-react';
import { usePathname, useRouter } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResultCard } from '@/components/marketplace/result-card';
import { CommissionTable } from '@/components/marketplace/commission-table';
import { calculateShopee, calculateShippingCost, defaultShopeeInputs, type ShopeeInputs, type MarketplaceResult } from '@/lib/marketplace-calculations';
import { ImportBudgetDialog } from '@/components/marketplace/import-budget-dialog';
import { useImportFromCalculator, type BudgetForImport, type PriceField } from '@/hooks/use-import-budget';

function NumericField({ label, value, onChange, prefix, suffix, tooltip }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-white/50">{label}</Label>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-white/20 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-black border-white/10 text-white/80 text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">{prefix}</span>}
        <Input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-gold font-mono text-sm ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">{suffix}</span>}
      </div>
    </div>
  );
}

const SHOPEE_BRAND_COLOR = '#EE4D2D';

export function ShopeeCalculator() {
  const [inputs, setInputs] = useState<ShopeeInputs>({ ...defaultShopeeInputs });
  const [budgetName, setBudgetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const router = useRouter();
  const editingId = usePathname().split('/')[4];
  const [loaded, setLoaded] = useState(!editingId);

  useEffect(() => {
    if (!editingId) return;
    const controller = new AbortController();
    fetch(`/api/marketplace-budgets/${editingId}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Orçamento indisponível.');
        const row = await response.json();
        if (row.marketplace !== 'shopee') throw new Error('Orçamento de outro marketplace.');
        setInputs(previous => ({ ...previous, ...row, width: row.widthF }));
        setBudgetName(row.name);
        setLoaded(true);
      })
      .catch(() => { if (!controller.signal.aborted) toast.error('Não foi possível abrir o orçamento.'); });
    return () => controller.abort();
  }, [editingId]);

  const { importedData, clearImported } = useImportFromCalculator();

  useEffect(() => {
    if (importedData) {
      const price = importedData.priceField === 'precoVenda' ? importedData.precoVenda : importedData.custoTotal;
      setInputs((prev) => ({ ...prev, productCost: price }));
      setBudgetName(importedData.name || '');
      const label = importedData.priceField === 'precoVenda' ? 'preço de venda' : 'custo total';
      toast.success(`Orçamento "${importedData.name}" importado! ${label.charAt(0).toUpperCase() + label.slice(1)} usado como custo do produto.`);
      clearImported();
    }
  }, [importedData, clearImported]);

  const handleImportSelect = (budget: BudgetForImport, priceField: PriceField) => {
    const price = priceField === 'precoVenda' ? budget.precoVenda : budget.custoTotal;
    setInputs((prev) => ({ ...prev, productCost: price }));
    setBudgetName(budget.name || '');
    setImportDialogOpen(false);
    const label = priceField === 'precoVenda' ? 'Preço de venda' : 'Custo total';
    toast.success(`Orçamento "${budget.name}" importado! ${label} usado como custo do produto.`);
  };

  const result: MarketplaceResult = useMemo(() => calculateShopee(inputs), [inputs]);

  const autoShippingCost = useMemo(() => {
    if (inputs.shippingMode === 'auto' && inputs.weight > 0) {
      return calculateShippingCost(inputs.weight, inputs.height, inputs.width, inputs.depth);
    }
    return 0;
  }, [inputs.shippingMode, inputs.weight, inputs.height, inputs.width, inputs.depth]);

  const updateField = <K extends keyof ShopeeInputs>(field: K, value: ShopeeInputs[K]) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const fmt = (v: number) => `R$ ${(v ?? 0).toFixed(2).replace('.', ',')}`;

  const handleSave = async () => {
    if (!budgetName.trim()) {
      toast.error('Dê um nome ao orçamento');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/marketplace-budgets/${editingId}` : '/api/marketplace-budgets', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: budgetName.trim(),
          marketplace: 'shopee',
          ...inputs,
          sellingPrice: result.sellingPrice,
          totalFees: result.totalFees,
          netProfit: result.netProfit,
          profitMargin: result.profitMargin,
          commissionPercentage: result.commissionPercentage,
          commissionFixed: result.commissionFixed,
          commissionAdditional: result.commissionAdditional,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar');
        return;
      }
      toast.success('Orçamento salvo com sucesso!');
      if (editingId) router.push('/dashboard/marketplace/historico');
      else setBudgetName('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar orçamento');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p role="status">Carregando orçamento…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" style={{ color: SHOPEE_BRAND_COLOR }} />
          Calculadora Shopee
        </h1>
        <p className="text-sm text-white/40 mt-1">Calcule o preço de venda ideal para seus produtos na Shopee.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5" style={{ color: SHOPEE_BRAND_COLOR }} />
              <h3 className="text-sm font-semibold text-white/80">Custos e Impostos</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumericField
                label="Custo do Produto"
                value={inputs.productCost}
                onChange={(v) => updateField('productCost', v)}
                prefix="R$"
                tooltip="Preço de custo do produto"
              />
              <NumericField
                label="Outros Custos"
                value={inputs.otherCosts}
                onChange={(v) => updateField('otherCosts', v)}
                prefix="R$"
                tooltip="Embalagem, etiquetas, etc."
              />
              <NumericField
                label="Imposto"
                value={inputs.taxPercentage}
                onChange={(v) => updateField('taxPercentage', v)}
                suffix="%"
                tooltip="Percentual de imposto sobre a venda"
              />
            </div>
          </motion.div>

          {}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-5 h-5" style={{ color: SHOPEE_BRAND_COLOR }} />
              <h3 className="text-sm font-semibold text-white/80">Cálculo do Frete</h3>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inputs.freeShipping}
                  onChange={(e) => updateField('freeShipping', e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#EE4D2D]"
                />
                <div>
                  <p className="text-sm text-white/70">Frete Grátis (desconto Shopee)</p>
                  <p className="text-xs text-white/40">Muitas vezes a Shopee oferece frete grátis ao comprador</p>
                </div>
              </label>
              {!inputs.freeShipping && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updateField('shippingMode', 'auto')}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        inputs.shippingMode === 'auto'
                          ? 'border-[#EE4D2D]/50 bg-[#EE4D2D]/10 text-[#EE4D2D]'
                          : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20'
                      }`}
                    >
                      Automático
                    </button>
                    <button
                      onClick={() => updateField('shippingMode', 'manual')}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        inputs.shippingMode === 'manual'
                          ? 'border-[#EE4D2D]/50 bg-[#EE4D2D]/10 text-[#EE4D2D]'
                          : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20'
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                  {inputs.shippingMode === 'auto' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-white/40">Peso volumétrico = (A × L × P) / 6000</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <NumericField label="Peso" value={inputs.weight} onChange={(v) => updateField('weight', v)} suffix="kg" tooltip="Peso real do produto" />
                        <NumericField label="Altura" value={inputs.height} onChange={(v) => updateField('height', v)} suffix="cm" />
                        <NumericField label="Largura" value={inputs.width} onChange={(v) => updateField('width', v)} suffix="cm" />
                        <NumericField label="Profundidade" value={inputs.depth} onChange={(v) => updateField('depth', v)} suffix="cm" />
                      </div>
                      {autoShippingCost > 0 && (
                        <div className="p-3 rounded-lg bg-gold/10 border border-gold/20">
                          <p className="text-xs text-white/40">Frete calculado</p>
                          <p className="text-sm font-mono text-gold font-semibold">{fmt(autoShippingCost)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <NumericField
                      label="Custo do Frete"
                      value={inputs.shippingCost}
                      onChange={(v) => updateField('shippingCost', v)}
                      prefix="R$"
                      tooltip="Custo real do frete que você paga para enviar o produto"
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>

          {}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5" style={{ color: SHOPEE_BRAND_COLOR }} />
              <h3 className="text-sm font-semibold text-white/80">Campanhas de Destaque</h3>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.highlightCampaigns}
                onChange={(e) => updateField('highlightCampaigns', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#EE4D2D]"
              />
              <div>
                <p className="text-sm text-white/70">Participar de Campanhas de Destaque</p>
                <p className="text-xs text-white/40">Taxa adicional de 3,5% sobre o preço de venda</p>
              </div>
            </label>
          </motion.div>

          {}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" style={{ color: SHOPEE_BRAND_COLOR }} />
              <h3 className="text-sm font-semibold text-white/80">Modo de Precificação</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateField('pricingMode', 'margin')}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  inputs.pricingMode === 'margin'
                    ? 'border-[#EE4D2D]/50 bg-[#EE4D2D]/10 text-[#EE4D2D]'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20'
                }`}
              >
                Por Margem
              </button>
              <button
                onClick={() => updateField('pricingMode', 'price')}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  inputs.pricingMode === 'price'
                    ? 'border-[#EE4D2D]/50 bg-[#EE4D2D]/10 text-[#EE4D2D]'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/20'
                }`}
              >
                Por Preço de Venda
              </button>
            </div>
            <NumericField
              label={inputs.pricingMode === 'margin' ? 'Margem Desejada' : 'Preço de Venda'}
              value={inputs.desiredMargin}
              onChange={(v) => updateField('desiredMargin', v)}
              suffix={inputs.pricingMode === 'margin' ? '%' : 'R$'}
              tooltip={inputs.pricingMode === 'margin' ? 'Percentual de lucro desejado' : 'Preço final de venda'}
            />
          </motion.div>

          {}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <Button
              variant="outline"
              className="w-full border-dashed border-white/10 text-white/50 hover:text-gold hover:border-gold/20"
              onClick={() => setImportDialogOpen(true)}
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Importar da Calculadora 3D
            </Button>
          </motion.div>

          {}
          <CommissionTable
            title="Política de Comissão Shopee"
            description="A Shopee cobra a comissão em duas partes: um percentual sobre o preço de venda mais uma taxa fixa por pedido. O valor varia conforme a faixa de preço do produto (vigente para vendedores CNPJ em 2026)."
            rows={[
              { label: 'Até R$ 79,99', value: '20% + R$ 4' },
              { label: 'R$ 80,00 a R$ 99,99', value: '14% + R$ 16' },
              { label: 'R$ 100,00 a R$ 199,99', value: '14% + R$ 20' },
              { label: 'R$ 200,00 a R$ 499,99', value: '14% + R$ 26' },
              { label: 'Acima de R$ 500,00', value: '14% + R$ 26' },
            ]}
          />
        </div>

        {}
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="sticky top-20 space-y-5">
            {result.error ? (
              <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{result.error}</p>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-gradient-to-br from-[#EE4D2D]/10 via-transparent to-[#EE4D2D]/5 border border-[#EE4D2D]/15 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-5 h-5 text-[#EE4D2D]" />
                  <h3 className="text-sm font-semibold text-[#EE4D2D]">Resultado</h3>
                </div>

                <ResultCard
                  label={inputs.pricingMode === 'margin' ? 'Preço de Venda Sugerido' : 'Preço de Venda'}
                  value={fmt(result.sellingPrice)}
                  highlight
                  icon={DollarSign}
                />
                <ResultCard label="Lucro Líquido" value={fmt(result.netProfit)} />
                <ResultCard label="Margem Real" value={`${result.profitMargin.toFixed(1)}%`} />

                <div className="border-t border-white/5 pt-3 space-y-2">
                  <p className="text-xs text-white/30 font-semibold uppercase tracking-wider">Detalhamento</p>
                  {[
                    { label: 'Custo do Produto', value: result.breakdown.productCost },
                    { label: 'Outros Custos', value: result.breakdown.otherCosts },
                    ...(result.breakdown.shippingCostAmount > 0 ? [{ label: 'Frete', value: result.breakdown.shippingCostAmount }] : []),
                    { label: `Comissão (${result.commissionPercentage}%)`, value: result.breakdown.commissionPercentAmount },
                    { label: 'Taxa Fixa', value: result.breakdown.commissionFixedAmount },
                    ...(result.breakdown.additionalFeeAmount > 0 ? [{ label: `Campanhas Destaque (${result.commissionAdditional}%)`, value: result.breakdown.additionalFeeAmount }] : []),
                    { label: `Imposto (${inputs.taxPercentage}%)`, value: result.breakdown.taxAmount },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-white/40">{item.label}</span>
                      <span className="text-white/70 font-mono">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/5 pt-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-white/50">Total de Taxas</span>
                    <span className="text-white font-mono">{fmt(result.totalFees)}</span>
                  </div>
                </div>
              </div>
            )}

            {}
            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
              <Label className="text-xs text-white/50">Nome do Orçamento</Label>
              <Input
                placeholder="Ex: Pelúcia Shopee"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-gold"
              />
              <Button
                onClick={handleSave}
                disabled={saving || !!result.error}
                className="w-full font-semibold text-white border-0"
                style={{ backgroundColor: SHOPEE_BRAND_COLOR }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingId ? 'Salvar alterações' : 'Salvar Orçamento'}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      <ImportBudgetDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSelect={handleImportSelect}
      />
    </div>
  );
}

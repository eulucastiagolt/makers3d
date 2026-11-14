'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, Trash2, Download, FileText, FileSpreadsheet,
  Loader2, Calendar, DollarSign, Package, ShoppingBag, Store, ChevronDown, Search, TrendingUp, Clock,
} from 'lucide-react';
import { useRouter } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MarketplaceBudget {
  id: string;
  name: string;
  marketplace: string;
  productCost: number;
  otherCosts: number;
  taxPercentage: number;
  pricingMode: string;
  desiredMargin: number;
  sellingPrice: number;
  totalFees: number;
  netProfit: number;
  profitMargin: number;
  commissionPercentage: number;
  commissionFixed: number;
  createdAt: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d?.toLocaleDateString?.('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) ?? '';
  } catch {
    return '';
  }
}

function fmt(v: number | null | undefined): string {
  return `R$ ${(v ?? 0)?.toFixed?.(2)?.replace?.('.', ',') ?? '0,00'}`;
}

function getMarketplaceLabel(marketplace: string): string {
  switch (marketplace) {
    case 'shopee': return 'Shopee';
    case 'tiktok': return 'TikTok Shop';
    case 'mercadolivre': return 'Mercado Livre';
    default: return marketplace;
  }
}

function getMarketplaceIcon(marketplace: string) {
  switch (marketplace) {
    case 'shopee': return ShoppingBag;
    case 'tiktok': return Store;
    case 'mercadolivre': return ShoppingBag;
    default: return Package;
  }
}

function getMarketplaceColor(marketplace: string): string {
  switch (marketplace) {
    case 'shopee': return '#EE4D2D';
    case 'tiktok': return '#00f2ea';
    case 'mercadolivre': return '#FFE600';
    default: return '#D4AF37';
  }
}

async function exportBudget(budget: MarketplaceBudget, format: string) {
  try {
    const label = getMarketplaceLabel(budget.marketplace);
    if (format === 'csv') {
      const rows = [
        ['Campo', 'Valor'],
        ['Nome', budget?.name ?? ''],
        ['Marketplace', label],
        ['Custo do Produto', String(budget?.productCost ?? 0)],
        ['Outros Custos', String(budget?.otherCosts ?? 0)],
        ['Imposto (%)', String(budget?.taxPercentage ?? 0)],
        ['Preço de Venda', String(budget?.sellingPrice ?? 0)],
        ['Total de Taxas', String(budget?.totalFees ?? 0)],
        ['Lucro Líquido', String(budget?.netProfit ?? 0)],
        ['Margem (%)', String(budget?.profitMargin ?? 0)],
      ];
      const csv = rows?.map?.((r) => r?.join?.(','))?.join?.('\n') ?? '';
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${budget?.name ?? 'orcamento'}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else if (format === 'txt') {
      const txt = [
        `ORÇAMENTO: ${budget?.name ?? ''}`,
        `Marketplace: ${label}`,
        `Data: ${formatDate(budget?.createdAt)}`,
        '',
        '--- PARÂMETROS ---',
        `Custo do Produto: R$ ${budget?.productCost ?? 0}`,
        `Outros Custos: R$ ${budget?.otherCosts ?? 0}`,
        `Imposto: ${budget?.taxPercentage ?? 0}%`,
        '',
        '--- RESULTADO ---',
        `Preço de Venda: ${fmt(budget?.sellingPrice)}`,
        `Total de Taxas: ${fmt(budget?.totalFees)}`,
        `Lucro Líquido: ${fmt(budget?.netProfit)}`,
        `Margem: ${budget?.profitMargin?.toFixed?.(1) ?? '0'}%`,
      ]?.join?.('\n') ?? '';
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${budget?.name ?? 'orcamento'}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    toast.success(`Orçamento exportado como ${format?.toUpperCase?.() ?? ''}`);
  } catch (err) {
    console.error('Export error:', err);
    toast.error('Erro ao exportar');
  }
}

export function MarketplaceHistory() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<MarketplaceBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    try {
      const url = filter !== 'all' ? `/api/marketplace-budgets?marketplace=${filter}` : '/api/marketplace-budgets';
      const res = await fetch(url);
      if (res?.ok) {
        const data = await res?.json?.();
        setBudgets(data ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleDelete = async (id: string) => {
    if (!id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/marketplace-budgets/${id}`, { method: 'DELETE' });
      if (res?.ok) {
        setBudgets((prev) => (prev ?? []).filter((b) => b?.id !== id));
        toast.success('Orçamento removido');
      } else {
        toast.error('Erro ao remover');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBudgets = budgets.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalVenda = filteredBudgets.reduce((acc, b) => acc + (b.sellingPrice ?? 0), 0);
  const totalLucro = filteredBudgets.reduce((acc, b) => acc + (b.netProfit ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-gold" />
          Histórico Marketplace
        </h1>
        <p className="text-sm text-white/40 mt-1">Consulte, exporte ou remova seus orçamentos de marketplace.</p>
      </div>

      {}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'Todos' },
          { value: 'shopee', label: 'Shopee', color: '#EE4D2D' },
          { value: 'tiktok', label: 'TikTok', color: '#00f2ea' },
          { value: 'mercadolivre', label: 'Mercado Livre', color: '#FFE600' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setLoading(true); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              filter === f.value
                ? f.value === 'all'
                  ? 'bg-gold/10 border-gold/20 text-gold'
                  : 'border-current text-current'
                : 'border-white/10 text-white/40 hover:text-white/60'
            }`}
            style={filter === f.value && f.value !== 'all' ? { color: f.color, borderColor: f.color, backgroundColor: `${f.color}15` } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {}
      {!loading && budgets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-gold" />
              <span className="text-xs text-white/40">Total</span>
            </div>
            <p className="text-lg font-bold text-white font-mono">{filteredBudgets.length}</p>
            <p className="text-xs text-white/30">orçamentos</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-white/40" />
              <span className="text-xs text-white/40">Receita Total</span>
            </div>
            <p className="text-lg font-bold text-white font-mono">{fmt(totalVenda)}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-gold" />
              <span className="text-xs text-white/40">Lucro Total</span>
            </div>
            <p className="text-lg font-bold text-gold font-mono">{fmt(totalLucro)}</p>
          </div>
        </div>
      )}

      {}
      {!loading && budgets.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Buscar orçamentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-gold pl-10"
          />
        </div>
      )}

      {}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : (filteredBudgets?.length ?? 0) === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30">
            {searchQuery ? 'Nenhum orçamento encontrado para essa busca.' : 'Nenhum orçamento de marketplace salvo ainda.'}
          </p>
          {!searchQuery && (
            <p className="text-white/20 text-sm mt-1">Use uma calculadora de marketplace para criar seu primeiro orçamento.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {(filteredBudgets ?? []).map((b, i) => {
              const Icon = getMarketplaceIcon(b.marketplace);
              const color = getMarketplaceColor(b.marketplace);
              const isExpanded = expandedId === b?.id;
              const margemReal = (b?.sellingPrice ?? 0) > 0 ? (((b?.netProfit ?? 0) / (b?.sellingPrice ?? 1)) * 100).toFixed(1) : '0';

              return (
                <motion.div
                  key={b?.id ?? i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all overflow-hidden"
                >
                  {}
                  <div
                    className="p-4 sm:p-5 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : (b?.id ?? null))}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color }} />
                          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                            {getMarketplaceLabel(b.marketplace)}
                          </span>
                          <h3 className="text-white font-semibold truncate">{b?.name ?? 'Orçamento'}</h3>
                          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs text-white/40">
                            <Calendar className="w-3 h-3" />
                            {formatDate(b?.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-white/40">
                            <DollarSign className="w-3 h-3" />
                            Custo: {fmt(b?.productCost)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs" style={{ color }}>
                            Lucro: {fmt(b?.netProfit)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-white/40">Venda</p>
                          <p className="text-sm font-mono text-white/70">{fmt(b?.sellingPrice)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gold/70">Margem</p>
                          <p className="text-sm font-mono text-gold font-bold">{margemReal}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-white/5 pt-4">
                          {}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="p-3 rounded-lg bg-white/[0.03]">
                              <p className="text-xs text-white/40">Custo</p>
                              <p className="text-sm font-mono text-white font-semibold">{fmt(b?.productCost + b?.otherCosts)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/[0.03]">
                              <p className="text-xs text-white/40">Lucro</p>
                              <p className={`text-sm font-mono font-semibold ${(b?.netProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {fmt(b?.netProfit)}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/[0.03]">
                              <p className="text-xs text-white/40">Taxas</p>
                              <p className="text-sm font-mono text-white/70 font-semibold">{fmt(b?.totalFees)}</p>
                            </div>
                          </div>

                          {}
                          <div className="flex flex-wrap gap-2 text-xs text-white/30 mb-4">
                            <span className="px-2 py-1 rounded bg-white/5">Imposto: {b?.taxPercentage ?? 0}%</span>
                            <span className="px-2 py-1 rounded bg-white/5">Comissão: {b?.commissionPercentage ?? 0}%</span>
                            <span className="px-2 py-1 rounded bg-white/5">Preço Venda: {fmt(b?.sellingPrice)}</span>
                          </div>

                          {}
                          <div className="flex flex-wrap gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-white/10 text-white/60 hover:text-gold hover:border-gold/20 relative z-10"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Exportar
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-[hsl(0,0%,10%)] border-white/10">
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/marketplace/${b.marketplace}/${b.id}/editar`)} className="cursor-pointer">
                                  Editar orçamento
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportBudget(b, 'csv')} className="text-white/70 hover:text-gold focus:text-gold cursor-pointer">
                                  <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportBudget(b, 'txt')} className="text-white/70 hover:text-gold focus:text-gold cursor-pointer">
                                  <FileText className="w-4 h-4 mr-2" /> TXT
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-white/30 hover:text-red-400 ml-auto relative z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(b?.id);
                              }}
                              disabled={deletingId === b?.id}
                            >
                              {deletingId === b?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            }) ?? []}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

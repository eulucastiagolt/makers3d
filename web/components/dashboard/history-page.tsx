'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/lib/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, Trash2, Download, FileText, FileSpreadsheet,
  File, Loader2, Calendar, DollarSign, Package, Pencil, ArrowRight,
  Search, Filter, ChevronDown, Clock, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useImportToMarketplace } from '@/hooks/use-import-budget';
import { MarketplacePriceDialog } from '@/components/marketplace/marketplace-price-dialog';
import type { PriceField } from '@/hooks/use-import-budget';

interface Budget {
  id: string;
  name: string;
  custoTotal: number;
  precoVenda: number;
  pesoPeca: number;
  tempoImpressao: number;
  margemLucro: number;
  createdAt: string;
  precoRoloFilamento: number;
  pesoRoloFilamento: number;
  potenciaImpressora: number;
  tarifaEnergia: number;
  precoImpressora: number;
  vidaUtilHoras: number;
  percentualManutencao: number;
  taxaFalhaPercentual: number;
  valorHoraTrabalho: number;
  tempoPreparacao: number;
  tempoPosProcessamento: number;
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

function calcLucro(b: Budget): number {
  return (b?.precoVenda ?? 0) - (b?.custoTotal ?? 0);
}

async function exportBudget(budget: Budget, format: string) {
  try {
    if (format === 'csv') {
      const rows = [
        ['Campo', 'Valor'],
        ['Nome', budget?.name ?? ''],
        ['Peso da Peça (g)', String(budget?.pesoPeca ?? 0)],
        ['Tempo Impressão (h)', String(budget?.tempoImpressao ?? 0)],
        ['Preço Rolo (R$)', String(budget?.precoRoloFilamento ?? 0)],
        ['Peso Rolo (g)', String(budget?.pesoRoloFilamento ?? 0)],
        ['Potência (W)', String(budget?.potenciaImpressora ?? 0)],
        ['Tarifa Energia (R$/kWh)', String(budget?.tarifaEnergia ?? 0)],
        ['Preço Impressora (R$)', String(budget?.precoImpressora ?? 0)],
        ['Vida Útil (h)', String(budget?.vidaUtilHoras ?? 0)],
        ['Manutenção (%)', String(budget?.percentualManutencao ?? 0)],
        ['Taxa Falha (%)', String(budget?.taxaFalhaPercentual ?? 0)],
        ['Valor/Hora Trabalho (R$)', String(budget?.valorHoraTrabalho ?? 0)],
        ['Tempo Preparação (min)', String(budget?.tempoPreparacao ?? 0)],
        ['Pós-Processamento (min)', String(budget?.tempoPosProcessamento ?? 0)],
        ['Margem Lucro (%)', String(budget?.margemLucro ?? 0)],
        ['Custo Total (R$)', String(budget?.custoTotal ?? 0)],
        ['Preço Venda (R$)', String(budget?.precoVenda ?? 0)],
      ];
      const csv = rows?.map?.((r: any) => r?.join?.(','))?.join?.('\n') ?? '';
      downloadFile(csv, `${budget?.name ?? 'orcamento'}.csv`, 'text/csv');
    } else if (format === 'txt') {
      const txt = [
        `ORÇAMENTO: ${budget?.name ?? ''}`,
        `Data: ${formatDate(budget?.createdAt)}`,
        '',
        '--- PARÂMETROS ---',
        `Peso da Peça: ${budget?.pesoPeca ?? 0}g`,
        `Tempo de Impressão: ${budget?.tempoImpressao ?? 0}h`,
        `Preço do Rolo: R$ ${budget?.precoRoloFilamento ?? 0}`,
        `Peso do Rolo: ${budget?.pesoRoloFilamento ?? 0}g`,
        `Potência: ${budget?.potenciaImpressora ?? 0}W`,
        `Tarifa Energia: R$ ${budget?.tarifaEnergia ?? 0}/kWh`,
        `Preço Impressora: R$ ${budget?.precoImpressora ?? 0}`,
        `Vida Útil: ${budget?.vidaUtilHoras ?? 0}h`,
        `Manutenção: ${budget?.percentualManutencao ?? 0}%`,
        `Taxa de Falha: ${budget?.taxaFalhaPercentual ?? 0}%`,
        `Valor/Hora Trabalho: R$ ${budget?.valorHoraTrabalho ?? 0}`,
        `Tempo Preparação: ${budget?.tempoPreparacao ?? 0}min`,
        `Pós-Processamento: ${budget?.tempoPosProcessamento ?? 0}min`,
        `Margem de Lucro: ${budget?.margemLucro ?? 0}%`,
        '',
        '--- RESULTADO ---',
        `Custo Total: R$ ${(budget?.custoTotal ?? 0)?.toFixed?.(2)}`,
        `Preço de Venda: R$ ${(budget?.precoVenda ?? 0)?.toFixed?.(2)}`,
        `Lucro: R$ ${((budget?.precoVenda ?? 0) - (budget?.custoTotal ?? 0))?.toFixed?.(2)}`,
      ]?.join?.('\n') ?? '';
      downloadFile(txt, `${budget?.name ?? 'orcamento'}.txt`, 'text/plain');
    } else if (format === 'xlsx') {
      const XLSX = await import('xlsx');
      const data = [
        { Campo: 'Nome', Valor: budget?.name ?? '' },
        { Campo: 'Peso da Peça (g)', Valor: budget?.pesoPeca ?? 0 },
        { Campo: 'Tempo Impressão (h)', Valor: budget?.tempoImpressao ?? 0 },
        { Campo: 'Preço Rolo (R$)', Valor: budget?.precoRoloFilamento ?? 0 },
        { Campo: 'Peso Rolo (g)', Valor: budget?.pesoRoloFilamento ?? 0 },
        { Campo: 'Potência (W)', Valor: budget?.potenciaImpressora ?? 0 },
        { Campo: 'Tarifa Energia (R$/kWh)', Valor: budget?.tarifaEnergia ?? 0 },
        { Campo: 'Preço Impressora (R$)', Valor: budget?.precoImpressora ?? 0 },
        { Campo: 'Vida Útil (h)', Valor: budget?.vidaUtilHoras ?? 0 },
        { Campo: 'Manutenção (%)', Valor: budget?.percentualManutencao ?? 0 },
        { Campo: 'Taxa Falha (%)', Valor: budget?.taxaFalhaPercentual ?? 0 },
        { Campo: 'Valor/Hora Trabalho (R$)', Valor: budget?.valorHoraTrabalho ?? 0 },
        { Campo: 'Tempo Preparação (min)', Valor: budget?.tempoPreparacao ?? 0 },
        { Campo: 'Pós-Processamento (min)', Valor: budget?.tempoPosProcessamento ?? 0 },
        { Campo: 'Margem Lucro (%)', Valor: budget?.margemLucro ?? 0 },
        { Campo: 'Custo Total (R$)', Valor: budget?.custoTotal ?? 0 },
        { Campo: 'Preço Venda (R$)', Valor: budget?.precoVenda ?? 0 },
      ];
      const ws = XLSX?.utils?.json_to_sheet?.(data);
      const wb = XLSX?.utils?.book_new?.();
      XLSX?.utils?.book_append_sheet?.(wb, ws, 'Orçamento');
      XLSX?.writeFile?.(wb, `${budget?.name ?? 'orcamento'}.xlsx`);
    } else if (format === 'pdf') {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Orçamento Impressão 3D', 14, 22);
      doc.setFontSize(12);
      doc.text(`Nome: ${budget?.name ?? ''}`, 14, 35);
      doc.text(`Data: ${formatDate(budget?.createdAt)}`, 14, 42);

      autoTable(doc, {
        startY: 52,
        head: [['Parâmetro', 'Valor']],
        body: [
          ['Peso da Peça', `${budget?.pesoPeca ?? 0}g`],
          ['Tempo Impressão', `${budget?.tempoImpressao ?? 0}h`],
          ['Preço Rolo', `R$ ${budget?.precoRoloFilamento ?? 0}`],
          ['Peso Rolo', `${budget?.pesoRoloFilamento ?? 0}g`],
          ['Potência', `${budget?.potenciaImpressora ?? 0}W`],
          ['Tarifa Energia', `R$ ${budget?.tarifaEnergia ?? 0}/kWh`],
          ['Preço Impressora', `R$ ${budget?.precoImpressora ?? 0}`],
          ['Vida Útil', `${budget?.vidaUtilHoras ?? 0}h`],
          ['Manutenção', `${budget?.percentualManutencao ?? 0}%`],
          ['Taxa Falha', `${budget?.taxaFalhaPercentual ?? 0}%`],
          ['Valor/Hora', `R$ ${budget?.valorHoraTrabalho ?? 0}`],
          ['Preparação', `${budget?.tempoPreparacao ?? 0}min`],
          ['Pós-Process.', `${budget?.tempoPosProcessamento ?? 0}min`],
          ['Margem Lucro', `${budget?.margemLucro ?? 0}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [180, 150, 50] },
      });

      const finalY = (doc as any)?.lastAutoTable?.finalY ?? 200;
      doc.setFontSize(14);
      doc.text(`Custo Total: R$ ${(budget?.custoTotal ?? 0)?.toFixed?.(2)}`, 14, finalY + 15);
      doc.text(`Preco de Venda: R$ ${(budget?.precoVenda ?? 0)?.toFixed?.(2)}`, 14, finalY + 25);
      doc.save(`${budget?.name ?? 'orcamento'}.pdf`);
    } else if (format === 'docx') {
      const content = [
        `ORÇAMENTO: ${budget?.name ?? ''}`,
        `Data: ${formatDate(budget?.createdAt)}`,
        '',
        'PARÂMETROS:',
        `Peso da Peça: ${budget?.pesoPeca ?? 0}g`,
        `Tempo de Impressão: ${budget?.tempoImpressao ?? 0}h`,
        `Preço do Rolo: R$ ${budget?.precoRoloFilamento ?? 0}`,
        `Potência: ${budget?.potenciaImpressora ?? 0}W`,
        `Tarifa Energia: R$ ${budget?.tarifaEnergia ?? 0}/kWh`,
        `Preço Impressora: R$ ${budget?.precoImpressora ?? 0}`,
        `Vida Útil: ${budget?.vidaUtilHoras ?? 0}h`,
        `Manutenção: ${budget?.percentualManutencao ?? 0}%`,
        `Taxa de Falha: ${budget?.taxaFalhaPercentual ?? 0}%`,
        `Valor/Hora: R$ ${budget?.valorHoraTrabalho ?? 0}`,
        `Preparação: ${budget?.tempoPreparacao ?? 0}min`,
        `Pós-Processamento: ${budget?.tempoPosProcessamento ?? 0}min`,
        `Margem: ${budget?.margemLucro ?? 0}%`,
        '',
        'RESULTADO:',
        `Custo Total: R$ ${(budget?.custoTotal ?? 0)?.toFixed?.(2)}`,
        `Preço de Venda: R$ ${(budget?.precoVenda ?? 0)?.toFixed?.(2)}`,
        `Lucro: R$ ${((budget?.precoVenda ?? 0) - (budget?.custoTotal ?? 0))?.toFixed?.(2)}`,
      ]?.join?.('\n') ?? '';
      downloadFile(content, `${budget?.name ?? 'orcamento'}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    toast.success(`Orçamento exportado como ${format?.toUpperCase?.() ?? ''}`!);
  } catch (err: any) {
    console.error('Export error:', err);
    toast.error('Erro ao exportar');
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content ?? ''], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function HistoryPage() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { importToMarketplace } = useImportToMarketplace();
  const [priceDialogBudget, setPriceDialogBudget] = useState<Budget | null>(null);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleMarketplaceClick = (budget: Budget) => {
    setPriceDialogBudget(budget);
    setPriceDialogOpen(true);
  };

  const handleMarketplaceSelect = (marketplace: 'shopee' | 'tiktok' | 'mercadolivre', priceField: PriceField) => {
    if (!priceDialogBudget) return;
    importToMarketplace(priceDialogBudget, marketplace, priceField);
  };

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch('/api/budgets');
      if (res?.ok) {
        const data = await res?.json?.();
        setBudgets(data ?? []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleDelete = async (id: string) => {
    if (!id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (res?.ok) {
        setBudgets((prev: Budget[]) => (prev ?? [])?.filter?.((b: Budget) => b?.id !== id) ?? []);
        toast.success('Orçamento removido');
      } else {
        toast.error('Erro ao remover');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao remover');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBudgets = budgets.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCusto = filteredBudgets.reduce((acc, b) => acc + (b.custoTotal ?? 0), 0);
  const totalVenda = filteredBudgets.reduce((acc, b) => acc + (b.precoVenda ?? 0), 0);

  return (
    <div className="space-y-6">
      {}
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-gold" />
          Histórico de Orçamentos
        </h1>
        <p className="text-sm text-white/40 mt-1">Consulte, edite, exporte ou remova seus orçamentos salvos.</p>
      </div>

      {}
      {!loading && budgets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-gold" />
              <span className="text-xs text-white/40">Total</span>
            </div>
            <p className="text-lg font-bold text-white font-mono">{budgets.length}</p>
            <p className="text-xs text-white/30">orçamentos</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-white/40" />
              <span className="text-xs text-white/40">Custo Total</span>
            </div>
            <p className="text-lg font-bold text-white font-mono">{fmt(totalCusto)}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-gold" />
              <span className="text-xs text-white/40">Lucro Potencial</span>
            </div>
            <p className="text-lg font-bold text-gold font-mono">{fmt(totalVenda - totalCusto)}</p>
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
            {searchQuery ? 'Nenhum orçamento encontrado para essa busca.' : 'Nenhum orçamento salvo ainda.'}
          </p>
          {!searchQuery && (
            <p className="text-white/20 text-sm mt-1">Use a calculadora para criar seu primeiro orçamento.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {(filteredBudgets ?? [])?.map?.((b: Budget, i: number) => {
              const isExpanded = expandedId === b?.id;
              const lucro = calcLucro(b);
              const margemReal = (b?.precoVenda ?? 0) > 0 ? ((lucro / (b?.precoVenda ?? 1)) * 100).toFixed(1) : '0';

              return (
                <motion.div
                  key={b?.id ?? i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-xl bg-white/[0.03] border border-white/5 hover:border-gold/10 transition-all overflow-hidden"
                >
                  {}
                  <div
                    className="p-4 sm:p-5 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : (b?.id ?? null))}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold truncate">{b?.name ?? 'Orçamento'}</h3>
                          <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs text-white/40">
                            <Calendar className="w-3 h-3" />
                            {formatDate(b?.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-white/40">
                            <Package className="w-3 h-3" />
                            {b?.pesoPeca ?? 0}g
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-white/40">
                            <Clock className="w-3 h-3" />
                            {b?.tempoImpressao ?? 0}h
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-white/40">Custo</p>
                          <p className="text-sm font-mono text-white/70">{fmt(b?.custoTotal)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gold/70">Venda</p>
                          <p className="text-sm font-mono text-gold font-bold">{fmt(b?.precoVenda)}</p>
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
                              <p className="text-sm font-mono text-white font-semibold">{fmt(b?.custoTotal)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/[0.03]">
                              <p className="text-xs text-white/40">Lucro</p>
                              <p className={`text-sm font-mono font-semibold ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {fmt(lucro)}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-white/[0.03]">
                              <p className="text-xs text-white/40">Margem</p>
                              <p className="text-sm font-mono text-gold font-semibold">{margemReal}%</p>
                            </div>
                          </div>

                          {}
                          <div className="flex flex-wrap gap-2 text-xs text-white/30 mb-4">
                            <span className="px-2 py-1 rounded bg-white/5">{b?.pesoRoloFilamento ?? 0}g rolo</span>
                            <span className="px-2 py-1 rounded bg-white/5">R$ {b?.precoRoloFilamento ?? 0}/rolo</span>
                            <span className="px-2 py-1 rounded bg-white/5">{b?.potenciaImpressora ?? 0}W</span>
                            <span className="px-2 py-1 rounded bg-white/5">{b?.margemLucro ?? 0}% margem</span>
                            <span className="px-2 py-1 rounded bg-white/5">{b?.taxaFalhaPercentual ?? 0}% falha</span>
                          </div>

                          {}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/40 relative z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/impressao3d/historico/${b.id}/editar`);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/10 text-white/60 hover:text-gold hover:border-gold/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarketplaceClick(b);
                              }}
                            >
                              <ArrowRight className="w-4 h-4 mr-1" />
                              Marketplace
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-white/10 text-white/60 hover:text-gold hover:border-gold/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Exportar
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-[hsl(0,0%,10%)] border-white/10">
                                <DropdownMenuItem onClick={() => exportBudget(b, 'pdf')} className="text-white/70 hover:text-gold focus:text-gold cursor-pointer">
                                  <FileText className="w-4 h-4 mr-2" /> PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportBudget(b, 'docx')} className="text-white/70 hover:text-gold focus:text-gold cursor-pointer">
                                  <File className="w-4 h-4 mr-2" /> DOCX
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => exportBudget(b, 'xlsx')} className="text-white/70 hover:text-gold focus:text-gold cursor-pointer">
                                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
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
                              className="text-white/30 hover:text-red-400 ml-auto"
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

      <MarketplacePriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        budget={priceDialogBudget}
        onSelect={handleMarketplaceSelect}
      />
    </div>
  );
}

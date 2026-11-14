'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator, Package, Zap, Cpu, Wrench, AlertTriangle,
  Clock, TrendingUp, Save, Loader2, DollarSign, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { calcularPreco, defaultInputs, type CalculationInputs, type CalculationResult } from '@/lib/calculations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function FieldGroup({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5 text-gold" />
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function NumericField({
  label,
  value,
  onChange,
  suffix,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
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
        <Input
          type="number"
          step="any"
          value={value}
          onChange={(e: any) => onChange(parseFloat(e?.target?.value ?? '0') || 0)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-gold pr-12 font-mono text-sm"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-gold/10 border border-gold/20' : 'bg-white/[0.03] border border-white/5'}`}>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`font-mono text-lg font-bold ${highlight ? 'text-gold' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export function CalculatorPage() {
  const [inputs, setInputs] = useState<CalculationInputs>(defaultInputs);
  const [budgetName, setBudgetName] = useState('');
  const [saving, setSaving] = useState(false);

  const result: CalculationResult = useMemo(() => calcularPreco(inputs), [inputs]);

  const updateField = (field: keyof CalculationInputs, value: number) => {
    setInputs((prev: CalculationInputs) => ({ ...(prev ?? {}), [field]: value }));
  };

  const fmt = (v: number) => `R$ ${(v ?? 0)?.toFixed?.(2)?.replace?.('.', ',') ?? '0,00'}`;

  const handleSave = async () => {
    if (!budgetName?.trim()) {
      toast.error('Dê um nome ao orçamento');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: budgetName?.trim(),
          ...inputs,
          custoTotal: result?.custoTotal ?? 0,
          precoVenda: result?.precoVenda ?? 0,
        }),
      });
      if (!res?.ok) {
        const data = await res?.json?.();
        toast.error(data?.error ?? 'Erro ao salvar');
        return;
      }
      toast.success('Orçamento salvo com sucesso!');
      setBudgetName('');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar orçamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Calculadora de Preços</h1>
        <p className="text-sm text-white/40 mt-1">Calcule o custo real e o preço de venda ideal para cada peça.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {}
        <div className="lg:col-span-2 space-y-5">
          <FieldGroup icon={Package} title="Custo do Filamento (Material)" delay={0}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumericField
                label="Preço do Rolo"
                value={inputs?.precoRoloFilamento ?? 100}
                onChange={(v: number) => updateField('precoRoloFilamento', v)}
                suffix="R$"
                tooltip="Preço de compra de um rolo de filamento. Referência PLA: ~R$100/kg"
              />
              <NumericField
                label="Peso do Rolo"
                value={inputs?.pesoRoloFilamento ?? 1000}
                onChange={(v: number) => updateField('pesoRoloFilamento', v)}
                suffix="g"
                tooltip="Peso total do rolo de filamento. Padrão: 1000g (1kg)"
              />
              <NumericField
                label="Peso da Peça"
                value={inputs?.pesoPeca ?? 20}
                onChange={(v: number) => updateField('pesoPeca', v)}
                suffix="g"
                tooltip="Peso da peça impressa, informado pelo fatiador/slicer"
              />
            </div>
          </FieldGroup>

          <FieldGroup icon={Clock} title="Tempo de Impressão" delay={0.05}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumericField
                label="Duração da Impressão"
                value={inputs?.tempoImpressao ?? 2}
                onChange={(v: number) => updateField('tempoImpressao', v)}
                suffix="horas"
                tooltip="Duração total da impressão, informada pelo slicer"
              />
            </div>
          </FieldGroup>

          <FieldGroup icon={Zap} title="Custo de Energia Elétrica" delay={0.1}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumericField
                label="Potência da Impressora"
                value={inputs?.potenciaImpressora ?? 300}
                onChange={(v: number) => updateField('potenciaImpressora', v)}
                suffix="W"
                tooltip="Consumo médio de energia da impressora 3D. Média: ~300W"
              />
              <NumericField
                label="Tarifa de Energia"
                value={inputs?.tarifaEnergia ?? 1}
                onChange={(v: number) => updateField('tarifaEnergia', v)}
                suffix="R$/kWh"
                tooltip="Tarifa de energia elétrica da sua concessão"
              />
            </div>
          </FieldGroup>

          <FieldGroup icon={Cpu} title="Depreciação da Impressora" delay={0.15}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumericField
                label="Preço da Impressora"
                value={inputs?.precoImpressora ?? 1500}
                onChange={(v: number) => updateField('precoImpressora', v)}
                suffix="R$"
                tooltip="Preço de compra da impressora 3D"
              />
              <NumericField
                label="Vida Útil"
                value={inputs?.vidaUtilHoras ?? 4000}
                onChange={(v: number) => updateField('vidaUtilHoras', v)}
                suffix="horas"
                tooltip="Vida útil estimada em horas de impressão. Conservador: 4000h"
              />
            </div>
          </FieldGroup>

          <FieldGroup icon={Wrench} title="Manutenção" delay={0.2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumericField
                label="Percentual de Manutenção"
                value={inputs?.percentualManutencao ?? 10}
                onChange={(v: number) => updateField('percentualManutencao', v)}
                suffix="%"
                tooltip="10% a 15% sobre o custo-hora da máquina para cobrir bicos, tubos PTFE, ventoinhas, etc."
              />
            </div>
          </FieldGroup>

          <FieldGroup icon={AlertTriangle} title="Taxa de Falha / Retrabalho" delay={0.25}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumericField
                label="Taxa de Falha"
                value={inputs?.taxaFalhaPercentual ?? 10}
                onChange={(v: number) => updateField('taxaFalhaPercentual', v)}
                suffix="%"
                tooltip="Percentual de impressões que falham. Ex: 1 falha a cada 10 = 10%"
              />
            </div>
          </FieldGroup>

          <FieldGroup icon={Clock} title="Mão de Obra (Opcional)" delay={0.3}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumericField
                label="Valor/Hora Trabalho"
                value={inputs?.valorHoraTrabalho ?? 20}
                onChange={(v: number) => updateField('valorHoraTrabalho', v)}
                suffix="R$/h"
                tooltip="Quanto vale sua hora de trabalho"
              />
              <NumericField
                label="Tempo Preparação"
                value={inputs?.tempoPreparacao ?? 15}
                onChange={(v: number) => updateField('tempoPreparacao', v)}
                suffix="min"
                tooltip="Tempo para fatiar o modelo e preparar a impressora"
              />
              <NumericField
                label="Pós-Processamento"
                value={inputs?.tempoPosProcessamento ?? 15}
                onChange={(v: number) => updateField('tempoPosProcessamento', v)}
                suffix="min"
                tooltip="Tempo para retirar, limpar, remover suportes e embalar"
              />
            </div>
          </FieldGroup>

          <FieldGroup icon={TrendingUp} title="Margem de Lucro" delay={0.35}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumericField
                label="Margem de Lucro"
                value={inputs?.margemLucro ?? 80}
                onChange={(v: number) => updateField('margemLucro', v)}
                suffix="%"
                tooltip="Percentual de lucro sobre o custo total. Margens de 80% a 120% são comuns."
              />
            </div>
          </FieldGroup>
        </div>

        {}
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="sticky top-20 space-y-5"
          >
            <div className="p-6 rounded-xl bg-gradient-to-br from-gold/10 via-transparent to-gold/5 border border-gold/15 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-gold" />
                <h3 className="text-sm font-semibold text-gold">Resultado</h3>
              </div>

              <ResultCard label="Preço de Venda Sugerido" value={fmt(result?.precoVenda ?? 0)} highlight />
              <ResultCard label="Custo Total" value={fmt(result?.custoTotal ?? 0)} />
              <ResultCard label="Lucro Estimado" value={fmt(result?.lucroEstimado ?? 0)} />

              <div className="border-t border-white/5 pt-4 space-y-2">
                <p className="text-xs text-white/30 font-semibold uppercase tracking-wider">Detalhamento</p>
                {[
                  { label: 'Filamento', value: result?.custoFilamento },
                  { label: 'Energia', value: result?.custoEnergia },
                  { label: 'Depreciação', value: result?.custoDepreciacao },
                  { label: 'Manutenção', value: result?.custoManutencao },
                  { label: 'Mão de Obra', value: result?.custoMaoDeObra },
                  { label: 'Taxa de Falha', value: result?.custoTaxaFalha },
                ]?.map?.((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-white/40">{item?.label ?? ''}</span>
                    <span className="text-white/70 font-mono">{fmt(item?.value ?? 0)}</span>
                  </div>
                )) ?? []}
              </div>

              <div className="border-t border-white/5 pt-4 space-y-2">
                <p className="text-xs text-white/30 font-semibold uppercase tracking-wider">Indicadores</p>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Custo/Grama</span>
                  <span className="text-white/70 font-mono">{fmt(result?.custoPorGrama ?? 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Custo/Hora Máquina</span>
                  <span className="text-white/70 font-mono">{fmt(result?.custoHoraMaquina ?? 0)}</span>
                </div>
              </div>
            </div>

            {}
            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
              <Label className="text-xs text-white/50">Nome do Orçamento</Label>
              <Input
                placeholder="Ex: Miniatura Dragão 20g"
                value={budgetName}
                onChange={(e: any) => setBudgetName(e?.target?.value ?? '')}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-gold"
              />
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-gold text-black hover:bg-[hsl(43,80%,60%)] font-semibold"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Orçamento
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

import { PrintDuration } from './print-duration';
import { PrintProfiles, usePrintProfiles } from './print-profiles';
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from '@/lib/navigation';
import {
  Package, AlertTriangle,
  Clock, TrendingUp, DollarSign, Loader2, Info, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { calcularPreco, type CalculationInputs } from '@/lib/calculations';

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
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-gold pr-12 font-mono text-sm"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function FieldGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-gold" />
        <h3 className="text-xs font-semibold text-white/80">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ResultCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-gold/10 border border-gold/20' : 'bg-white/[0.03] border border-white/5'}`}>
      <p className="text-xs text-white/40 mb-0.5">{label}</p>
      <p className={`font-mono text-base font-bold ${highlight ? 'text-gold' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export function EditBudgetPage() {
  const router = useRouter();
  const params = useParams();
  const budgetId = params?.id as string;

  const [budget, setBudget] = useState<Budget | null>(null);
  const [inputs, setInputs] = useState<CalculationInputs | null>(null);
  const [budgetName, setBudgetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const catalogue = usePrintProfiles();
  const [printerId, setPrinterId] = useState('');
  const [filamentId, setFilamentId] = useState('');


  useEffect(() => {
    if (!budgetId) return;
    setLoading(true);
    fetch(`/api/budgets/${budgetId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar orçamento');
        const data = await res.json();
        setBudget(data);
        setInputs({
          precoRoloFilamento: data.precoRoloFilamento,
          pesoRoloFilamento: data.pesoRoloFilamento,
          pesoPeca: data.pesoPeca,
          tempoImpressao: data.tempoImpressao,
          potenciaImpressora: data.potenciaImpressora,
          tarifaEnergia: data.tarifaEnergia,
          precoImpressora: data.precoImpressora,
          vidaUtilHoras: data.vidaUtilHoras,
          percentualManutencao: data.percentualManutencao,
          taxaFalhaPercentual: data.taxaFalhaPercentual,
          valorHoraTrabalho: data.valorHoraTrabalho,
          tempoPreparacao: data.tempoPreparacao,
          tempoPosProcessamento: data.tempoPosProcessamento,
          margemLucro: data.margemLucro,
        });
        setBudgetName(data.name);
      })
      .catch((err) => {
        console.error(err);
        setError('Não foi possível carregar o orçamento.');
      })
      .finally(() => setLoading(false));
  }, [budgetId]);

  const result = useMemo(() => {
    if (!inputs) return null;
    return calcularPreco(inputs);
  }, [inputs]);

  const updateField = (field: keyof CalculationInputs, value: number) => {
    setInputs((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const fmt = (v: number) => `R$ ${(v ?? 0).toFixed(2).replace('.', ',')}`;

  const handleSave = async () => {
    if (!budget || !inputs || !result) return;
    if (!budgetName.trim()) {
      toast.error('Dê um nome ao orçamento');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: budgetName.trim(),
          ...inputs,
          custoTotal: result.custoTotal,
          precoVenda: result.precoVenda,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar');
        return;
      }
      toast.success('Orçamento atualizado com sucesso!');
      router.push('/dashboard/impressao3d/historico');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar orçamento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error || !budget || !inputs || !result) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40 mb-4">{error || 'Orçamento não encontrado.'}</p>
        <Button
          variant="outline"
          className="border-white/10 text-white/60 hover:text-gold hover:border-gold/20"
          onClick={() => router.push('/dashboard/impressao3d/historico')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Histórico
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-white/50 hover:text-gold"
          onClick={() => router.push('/dashboard/impressao3d/historico')}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-gold" />
            Editar Orçamento
          </h1>
          <p className="text-sm text-white/40 mt-1">Altere os parâmetros e veja o resultado atualizado em tempo real.</p>
        </div>
      </div>

      {}
      <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
        <Label className="text-xs text-white/50">Nome do Orçamento</Label>
        <Input
          value={budgetName}
          onChange={(e) => setBudgetName(e.target.value)}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-gold font-mono text-sm"
        />
      </div>

      {}
      <PrintProfiles catalogue={catalogue} printerId={printerId} filamentId={filamentId} editing
        onPrinter={(id, fields) => {
          setPrinterId(id);
          setInputs(previous => previous && ({ ...previous,
            potenciaImpressora: budget.potenciaImpressora, precoImpressora: budget.precoImpressora,
            vidaUtilHoras: budget.vidaUtilHoras, percentualManutencao: budget.percentualManutencao, ...fields }));
        }}
        onFilament={(id, fields) => {
          setFilamentId(id);
          setInputs(previous => previous && ({ ...previous,
            precoRoloFilamento: budget.precoRoloFilamento, pesoRoloFilamento: budget.pesoRoloFilamento, ...fields }));
        }} />

      <div className="space-y-4">
        <FieldGroup icon={Package} title="Material da Peça">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumericField
              label="Peso da Peça"
              value={inputs.pesoPeca}
              onChange={(v) => updateField('pesoPeca', v)}
              suffix="g"
              tooltip="Peso da peça impressa"
            />
          </div>
        </FieldGroup>

        <FieldGroup icon={Clock} title="Tempo de Impressão">
          <PrintDuration value={inputs.tempoImpressao} onChange={hours => updateField('tempoImpressao', hours)} />
        </FieldGroup>

        <FieldGroup icon={AlertTriangle} title="Taxa de Falha / Retrabalho">
          <NumericField
            label="Taxa de Falha"
            value={inputs.taxaFalhaPercentual}
            onChange={(v) => updateField('taxaFalhaPercentual', v)}
            suffix="%"
            tooltip="Percentual de impressões que falham"
          />
        </FieldGroup>

        <FieldGroup icon={Clock} title="Mão de Obra">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumericField
              label="Valor/Hora Trabalho"
              value={inputs.valorHoraTrabalho}
              onChange={(v) => updateField('valorHoraTrabalho', v)}
              suffix="R$/h"
            />
            <NumericField
              label="Tempo Preparação"
              value={inputs.tempoPreparacao}
              onChange={(v) => updateField('tempoPreparacao', v)}
              suffix="min"
            />
            <NumericField
              label="Pós-Processamento"
              value={inputs.tempoPosProcessamento}
              onChange={(v) => updateField('tempoPosProcessamento', v)}
              suffix="min"
            />
          </div>
        </FieldGroup>

        <FieldGroup icon={TrendingUp} title="Margem de Lucro">
          <NumericField
            label="Margem de Lucro"
            value={inputs.margemLucro}
            onChange={(v) => updateField('margemLucro', v)}
            suffix="%"
            tooltip="Percentual de lucro sobre o custo total"
          />
        </FieldGroup>
      </div>

      {}
      <div className="p-5 rounded-xl bg-gradient-to-br from-gold/10 via-transparent to-gold/5 border border-gold/15 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold text-gold">Resultado Atualizado</h3>
        </div>

        <ResultCard label="Preço de Venda Sugerido" value={fmt(result.precoVenda)} highlight />
        <ResultCard label="Custo Total" value={fmt(result.custoTotal)} />
        <ResultCard label="Lucro Estimado" value={fmt(result.lucroEstimado)} />

        <div className="border-t border-white/5 pt-3 space-y-1.5">
          <p className="text-xs text-white/30 font-semibold uppercase tracking-wider">Detalhamento</p>
          {[
            { label: 'Filamento', value: result.custoFilamento },
            { label: 'Energia', value: result.custoEnergia },
            { label: 'Depreciação', value: result.custoDepreciacao },
            { label: 'Manutenção', value: result.custoManutencao },
            { label: 'Mão de Obra', value: result.custoMaoDeObra },
            { label: 'Taxa de Falha', value: result.custoTaxaFalha },
          ].map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-white/40">{item.label}</span>
              <span className="text-white/70 font-mono">{fmt(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="sticky bottom-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gold text-black hover:bg-[hsl(43,80%,60%)] font-semibold py-6 text-base"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}

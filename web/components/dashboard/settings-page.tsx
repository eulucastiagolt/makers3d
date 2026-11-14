import { useEffect, useState, type FormEvent } from 'react';
import { Save, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { desktopApi } from '@/lib/desktop-api';

export type GeneralSettings = { electricityRate: number };

export function SettingsPage() {
  const [value, setValue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    desktopApi<GeneralSettings>('/api/settings', { signal: controller.signal })
      .then(settings => setValue(String(settings.electricityRate).replace('.', ',')))
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar as configurações.'); });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const rate = value?.trim().replace(',', '.') ?? '';
    const electricityRate = Number(rate);
    if (!rate || !Number.isFinite(electricityRate) || electricityRate < 0) {
      setError('Informe uma tarifa válida, maior ou igual a zero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const settings = await desktopApi<GeneralSettings>('/api/settings', {
        method: 'PUT', body: JSON.stringify({ electricityRate }),
      });
      setValue(String(settings.electricityRate).replace('.', ','));
      toast.success('Configurações salvas.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="space-y-6">
    <h1 className="font-display text-2xl font-bold text-white">Configurações</h1>
    <form onSubmit={save} className="max-w-xl space-y-4 rounded-xl border border-white/10 bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Zap className="size-4 text-gold" /> Energia elétrica</h2>
      <label className="block space-y-2">
        <span className="block text-sm">Tarifa padrão (R$/kWh)</span>
        <Input required inputMode="decimal" placeholder="Ex.: 0,95" value={value ?? ''} disabled={value === null || saving}
          onChange={event => setValue(event.target.value)} aria-describedby="electricity-help" />
      </label>
      <p id="electricity-help" className="text-sm text-white/60">Use a tarifa da sua conta de luz. Ela será usada nos novos orçamentos.</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <Button type="submit" disabled={value === null || saving}><Save className="mr-2 size-4" /> Salvar configurações</Button>
    </form>
  </section>;
}

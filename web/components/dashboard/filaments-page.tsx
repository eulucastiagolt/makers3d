import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Layers, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { desktopApi } from '@/lib/desktop-api';

export type Filament = {
  id: string;
  name: string;
  price: number;
  weight: number;
  material: string;
  color: string;
};

const defaults = { name: '', material: '', color: '', price: '', weight: '1000' };
const fields = [
  ['price', 'Preço do rolo (R$)'],
  ['weight', 'Peso líquido do filamento (g)'],
] as const;

export function FilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    desktopApi<Filament[]>('/api/filaments', { signal: controller.signal })
      .then(setFilaments)
      .catch(error => { if (!controller.signal.aborted) toast.error(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function reset() {
    setForm(defaults);
    setEditing(null);
  }

  function edit(filament: Filament) {
    setEditing(filament.id);
    setForm({ name: filament.name, price: String(filament.price), weight: String(filament.weight), material: filament.material, color: filament.color });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const record = await desktopApi<Filament>(editing ? `/api/filaments/${editing}` : '/api/filaments', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name: form.name, material: form.material, color: form.color, ...Object.fromEntries(fields.map(([key]) => [key, Number(form[key].replace(',', '.'))])) }),
      });
      setFilaments(previous => editing ? previous.map(item => item.id === record.id ? record : item) : [...previous, record]);
      reset();
      toast.success('Filamento salvo.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar o filamento.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await desktopApi(`/api/filaments/${id}`, { method: 'DELETE' });
      setFilaments(previous => previous.filter(item => item.id !== id));
      if (editing === id) reset();
      toast.success('Filamento excluído.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao excluir o filamento.');
    } finally {
      setRemoving(null);
      setBusy(false);
    }
  }

  return <section className="space-y-6">
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Filamentos</h1>
      <p className="mt-1 text-sm text-white/60">Cadastre seus rolos para reutilizar o preço e o peso na calculadora.</p>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={save} className="space-y-4 rounded-xl border border-white/10 bg-card p-5">
        <h2 className="font-semibold">{editing ? 'Editar filamento' : 'Novo filamento'}</h2>
        <label className="block space-y-2"><span>Nome do filamento</span>
          <Input required maxLength={150} placeholder="Ex.: Rolo de PLA preto" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2"><span className="block text-sm">Material</span>
            <Input required maxLength={60} placeholder="Ex.: PLA, PETG ou ABS" value={form.material} onChange={event => setForm({ ...form, material: event.target.value })} />
          </label>
          <label className="space-y-2"><span className="block text-sm">Cor (opcional)</span>
            <Input maxLength={60} value={form.color} onChange={event => setForm({ ...form, color: event.target.value })} />
          </label>
          {fields.map(([key, label]) => <label key={key} className="space-y-2"><span className="block text-sm">{label}</span>
            <Input type="number" min={key === 'weight' ? '0.01' : '0'} step="any" required value={form[key]}
              onChange={event => setForm({ ...form, [key]: event.target.value })} />
          </label>)}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || loading}><Plus className="mr-2 size-4" /> Salvar filamento</Button>
          {editing && <Button type="button" variant="outline" disabled={busy} onClick={reset}>Cancelar</Button>}
        </div>
      </form>
      <div className="space-y-3">
        {loading && <p role="status">Carregando filamentos…</p>}
        {!loading && filaments.length === 0 && <p className="rounded-xl border border-white/10 p-5 text-white/60">Nenhum filamento cadastrado.</p>}
        {filaments.map(filament => <article key={filament.id} className="rounded-xl border border-white/10 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><Layers className="size-4 text-gold" />{filament.name}</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label={`Editar ${filament.name}`} disabled={busy} onClick={() => edit(filament)}><Pencil className="size-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Excluir ${filament.name}`} disabled={busy} onClick={() => setRemoving(filament.id)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-white/60">{filament.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {filament.weight} g · {filament.material}{filament.color && ` · ${filament.color}`}</p>
          {removing === filament.id && <div className="mt-3 flex gap-2">
            <Button variant="destructive" disabled={busy} onClick={() => void remove(filament.id)}>Confirmar exclusão</Button>
            <Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</Button>
          </div>}
        </article>)}
      </div>
    </div>
  </section>;
}

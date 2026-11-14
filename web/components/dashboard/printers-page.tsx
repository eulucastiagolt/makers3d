import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Printer as PrinterIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { desktopApi } from '@/lib/desktop-api';

export type Printer = {
  id: string;
  name: string;
  price: number;
  power: number;
  lifetime: number;
  maintenance: number;
};

const defaults = { name: '', price: '1500', power: '300', lifetime: '4000', maintenance: '10' };
const fields = [
  ['price', 'Preço de compra (R$)'],
  ['power', 'Potência média (W)'],
  ['lifetime', 'Vida útil estimada (h)'],
  ['maintenance', 'Manutenção sobre a depreciação (%)'],
] as const;

export function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    desktopApi<Printer[]>('/api/printers', { signal: controller.signal })
      .then(setPrinters)
      .catch(error => { if (!controller.signal.aborted) toast.error(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function reset() {
    setForm(defaults);
    setEditing(null);
  }

  function edit(printer: Printer) {
    setEditing(printer.id);
    setForm({ name: printer.name, price: String(printer.price), power: String(printer.power),
      lifetime: String(printer.lifetime), maintenance: String(printer.maintenance) });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const record = await desktopApi<Printer>(editing ? `/api/printers/${editing}` : '/api/printers', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name: form.name, ...Object.fromEntries(fields.map(([key]) => [key, Number(form[key].replace(',', '.'))])) }),
      });
      setPrinters(previous => editing ? previous.map(item => item.id === record.id ? record : item) : [...previous, record]);
      reset();
      toast.success('Impressora salva.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar a impressora.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await desktopApi(`/api/printers/${id}`, { method: 'DELETE' });
      setPrinters(previous => previous.filter(item => item.id !== id));
      if (editing === id) reset();
      toast.success('Impressora excluída.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao excluir a impressora.');
    } finally {
      setRemoving(null);
      setBusy(false);
    }
  }

  return <section className="space-y-6">
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Impressoras</h1>
      <p className="mt-1 text-sm text-white/60">Cadastre suas máquinas para reutilizar os dados na calculadora.</p>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={save} className="space-y-4 rounded-xl border border-white/10 bg-card p-5">
        <h2 className="font-semibold">{editing ? 'Editar impressora' : 'Nova impressora'}</h2>
        <label className="block space-y-2"><span>Nome ou modelo</span>
          <Input required maxLength={150} placeholder="Ex.: Bambu Lab A1" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([key, label]) => <label key={key} className="space-y-2"><span className="block text-sm">{label}</span>
            <Input type="number" min={key === 'lifetime' ? '0.01' : '0'} step="any" required value={form[key]}
              onChange={event => setForm({ ...form, [key]: event.target.value })} />
          </label>)}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || loading}><Plus className="mr-2 size-4" /> Salvar impressora</Button>
          {editing && <Button type="button" variant="outline" disabled={busy} onClick={reset}>Cancelar</Button>}
        </div>
      </form>
      <div className="space-y-3">
        {loading && <p role="status">Carregando impressoras…</p>}
        {!loading && printers.length === 0 && <p className="rounded-xl border border-white/10 p-5 text-white/60">Nenhuma impressora cadastrada.</p>}
        {printers.map(printer => <article key={printer.id} className="rounded-xl border border-white/10 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><PrinterIcon className="size-4 text-gold" />{printer.name}</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label={`Editar ${printer.name}`} disabled={busy} onClick={() => edit(printer)}><Pencil className="size-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Excluir ${printer.name}`} disabled={busy} onClick={() => setRemoving(printer.id)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-white/60">{printer.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · {printer.power} W · {printer.lifetime} h · {printer.maintenance}% de manutenção</p>
          {removing === printer.id && <div className="mt-3 flex gap-2">
            <Button variant="destructive" disabled={busy} onClick={() => void remove(printer.id)}>Confirmar exclusão</Button>
            <Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Cancelar</Button>
          </div>}
        </article>)}
      </div>
    </div>
  </section>;
}

import { useEffect, useState } from 'react';
import { desktopApi } from '@/lib/desktop-api';
import { Link } from '@/lib/navigation';
import type { CalculationInputs } from '@/lib/calculations';
import type { Printer } from './printers-page';
import type { Filament } from './filaments-page';

type ProfileFields = Partial<CalculationInputs>;

export function usePrintProfiles() {
  const [profiles, setProfiles] = useState<{ printers: Printer[]; filaments: Filament[] } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([
      desktopApi<Printer[]>('/api/printers', options),
      desktopApi<Filament[]>('/api/filaments', options),
    ]).then(([printers, filaments]) => setProfiles({ printers, filaments }))
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);

  return { profiles, error };
}

export function PrintProfiles({ catalogue, printerId, filamentId, onPrinter, onFilament, editing = false }: {
  catalogue: ReturnType<typeof usePrintProfiles>;
  printerId: string;
  filamentId: string;
  onPrinter: (id: string, fields: ProfileFields) => void;
  onFilament: (id: string, fields: ProfileFields) => void;
  editing?: boolean;
}) {
  const { profiles, error } = catalogue;
  const style = 'w-full rounded-lg border border-white/15 bg-background px-3 py-2';
  return <section aria-label="Perfis do orçamento" className="space-y-3 rounded-xl border border-white/10 bg-card p-4 text-sm">
    {error && <p role="alert">Não foi possível carregar os cadastros.</p>}
    {!profiles && !error && <p role="status">Carregando cadastros…</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <label className="block space-y-2"><span>Impressora</span>
          <select className={style} disabled={!profiles?.printers.length} value={printerId} onChange={event => {
            const id = event.target.value;
            const printer = profiles?.printers.find(item => item.id === id);
            onPrinter(id, printer ? { potenciaImpressora: printer.power, precoImpressora: printer.price,
              vidaUtilHoras: printer.lifetime, percentualManutencao: printer.maintenance } : {});
          }}>
            <option value="" disabled={!editing}>{editing ? 'Manter dados do orçamento' : 'Selecione uma impressora'}</option>
            {profiles?.printers.map(printer => <option key={printer.id} value={printer.id}>{printer.name}</option>)}
          </select>
        </label>
        {!editing && profiles?.printers.length === 0 && <Link className="text-gold hover:underline" href="/impressoras">Cadastrar impressora</Link>}
      </div>
      <div className="space-y-2">
        <label className="block space-y-2"><span>Filamento</span>
          <select className={style} disabled={!profiles?.filaments.length} value={filamentId} onChange={event => {
            const id = event.target.value;
            const filament = profiles?.filaments.find(item => item.id === id);
            onFilament(id, filament ? { precoRoloFilamento: filament.price, pesoRoloFilamento: filament.weight } : {});
          }}>
            <option value="" disabled={!editing}>{editing ? 'Manter dados do orçamento' : 'Selecione um filamento'}</option>
            {profiles?.filaments.map(filament => <option key={filament.id} value={filament.id}>{filament.name} · {filament.material}{filament.color && ` · ${filament.color}`}</option>)}
          </select>
        </label>
        {!editing && profiles?.filaments.length === 0 && <Link className="text-gold hover:underline" href="/filamentos">Cadastrar filamento</Link>}
      </div>
    </div>
  </section>;
}

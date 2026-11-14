import { createRoot } from 'react-dom/client';
import { HardDriveDownload, Upload } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { CalculatorPage } from '@/components/dashboard/calculator-page';
import { HistoryPage } from '@/components/dashboard/history-page';
import { EditBudgetPage } from '@/components/dashboard/edit-budget-page';
import { ShopeeCalculator } from '@/components/marketplace/shopee-calculator';
import { TiktokCalculator } from '@/components/marketplace/tiktok-calculator';
import { MercadolivreCalculator } from '@/components/marketplace/mercadolivre-calculator';
import { MarketplaceHistory } from '@/components/marketplace/marketplace-history';
import { Button } from '@/components/ui/button';
import { usePathname, printHistory } from '@/lib/navigation';

function Backup() {
  async function load(file: File) {
    try {
      const response = await fetch('/api/backup', { method: 'POST', body: await file.text() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(`${result.added} orçamento(s) importado(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao importar backup.');
    }
  }

  async function save() {
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error('Falha ao gerar backup.');
      const url = URL.createObjectURL(await response.blob());
      const download = document.createElement('a');
      download.href = url;
      download.download = 'makers3d-backup.json';
      download.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao exportar backup.');
    }
  }

  return <section className="space-y-6">
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Backup e dados</h1>
      <p className="mt-1 text-sm text-white/50">Seus orçamentos ficam neste computador. Importe um JSON para adicionar os registros ausentes.</p>
    </div>
    <div className="flex flex-wrap gap-3 rounded-xl border border-white/10 bg-card p-5">
      <Button onClick={save}><HardDriveDownload className="mr-2 size-4" /> Exportar backup</Button>
      <Button variant="outline" asChild>
        <label className="cursor-pointer"><Upload className="mr-2 size-4" /> Importar backup
          <input className="sr-only" type="file" accept=".json,application/json" onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void load(file);
          }} />
        </label>
      </Button>
    </div>
  </section>;
}

const pages: Record<string, React.ComponentType> = {
  '/dashboard/impressao3d/calculadora': CalculatorPage,
  [printHistory]: HistoryPage,
  '/dashboard/marketplace/shopee': ShopeeCalculator,
  '/dashboard/marketplace/tiktok': TiktokCalculator,
  '/dashboard/marketplace/mercadolivre': MercadolivreCalculator,
  '/dashboard/marketplace/historico': MarketplaceHistory,
  '/backup': Backup,
};

function App() {
  const pathname = usePathname();
  const Page = /^\/dashboard\/impressao3d\/historico\/[^/]+\/editar$/.test(pathname)
    ? EditBudgetPage : pages[pathname.replace(/\/[^/]+\/editar$/, '')] ?? CalculatorPage;
  return <DashboardShell><Page key={pathname} /><Toaster theme="dark" richColors /></DashboardShell>;
}

createRoot(document.getElementById('root')!).render(<App />);

'use client';

import { useState } from 'react';
import { Link } from '@/lib/navigation';
import { usePathname } from '@/lib/navigation';
import {
  Printer, Calculator, History, HardDrive, Settings, Menu, X, ChevronRight,
  ShoppingBag, Store, MessageSquare, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav3D = [
  { href: '/impressoras', label: 'Impressoras', icon: Printer },
  { href: '/filamentos', label: 'Filamentos', icon: Layers },
  { href: '/dashboard/impressao3d/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/dashboard/impressao3d/historico', label: 'Histórico', icon: History },
];

const navMarketplace = [
  { href: '/dashboard/marketplace/shopee', label: 'Shopee', icon: ShoppingBag, color: '#EE4D2D' },
  { href: '/dashboard/marketplace/tiktok', label: 'TikTok Shop', icon: Store, color: '#00f2ea' },
  { href: '/dashboard/marketplace/mercadolivre', label: 'Mercado Livre', icon: ShoppingBag, color: '#FFE600' },
  { href: '/dashboard/marketplace/historico', label: 'Histórico', icon: History },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-x-0 top-0 z-50 flex h-12 items-center border-b border-white/10 bg-background px-4 lg:hidden">
        <button type="button" aria-expanded={sidebarOpen} aria-controls="dashboard-sidebar"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-white/80 hover:bg-white/10"
          onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          Menu
        </button>
      </div>

      <aside
        id="dashboard-sidebar"
        className={cn(
          'fixed top-12 lg:top-0 left-0 bottom-0 w-60 bg-black/60 backdrop-blur-xl border-r border-white/5 z-40 transition-transform duration-300 overflow-y-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <nav className="p-4 space-y-1">
          {}
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Impressão 3D</p>
          </div>
          {nav3D.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gold/10 text-gold'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}

          <div className="border-t border-white/5 my-3" />

          {}
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Marketplace</p>
          </div>
          {navMarketplace.map((item) => {
            const isActive = pathname === item.href;
            const itemColor = 'color' in item ? (item as any).color : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive && itemColor
                    ? 'text-current bg-white/5'
                    : isActive
                    ? 'bg-gold/10 text-gold'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                )}
                style={isActive && itemColor ? { color: itemColor, backgroundColor: `${itemColor}15` } : undefined}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}

          <div className="border-t border-white/5 my-3" />

          {}
          <Link href="/chat" onClick={() => setSidebarOpen(false)} className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
            pathname === '/chat' ? 'bg-gold/10 text-gold' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          )}>
            <MessageSquare className="size-4" />
            Chat com IA
          </Link>
          <Link href="/configuracoes" onClick={() => setSidebarOpen(false)} className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
            pathname === '/configuracoes' ? 'bg-gold/10 text-gold' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
          )}>
            <Settings className="size-4" />
            Configurações
          </Link>
          <Link
            href="/backup"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              pathname === '/backup'
                ? 'bg-gold/10 text-gold'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            )}
          >
            <HardDrive className="w-4 h-4" />
            Backup e dados
          </Link>
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="pt-12 lg:pt-0 lg:pl-60">
        <div className="max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { Link } from '@/lib/navigation';
import { usePathname } from '@/lib/navigation';
import {
  Printer, Calculator, History, HardDrive, Menu, X, ChevronRight,
  ShoppingBag, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav3D = [
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
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-black/90 backdrop-blur-xl border-b border-white/5 flex items-center px-4">
        <button className="lg:hidden mr-3 text-white/60" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-gold" />
          <span className="font-display text-lg font-bold text-gold">Makers 3D</span>
        </Link>
      </header>

      <aside
        className={cn(
          'fixed top-14 left-0 bottom-0 w-60 bg-black/60 backdrop-blur-xl border-r border-white/5 z-40 transition-transform duration-300 overflow-y-auto',
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

      <main className="pt-14 lg:pl-60">
        <div className="max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
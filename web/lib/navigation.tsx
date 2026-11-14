import { useSyncExternalStore, type ComponentProps } from 'react';

const defaultPath = '/dashboard/impressao3d/calculadora';
export const printHistory = '/dashboard/impressao3d/historico';

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function currentPath() {
  const path = window.location.hash.slice(1);
  return !path || path === '/dashboard' ? defaultPath : path;
}

export function usePathname() {
  return useSyncExternalStore(subscribe, currentPath);
}

export function useParams() {
  return { id: usePathname().split('/').at(-2) };
}

export function useRouter() {
  return { push: (path: string) => { window.location.hash = path; } };
}

export function Link({ href, ...props }: ComponentProps<'a'>) {
  return <a {...props} href={`#${href}`} />;
}

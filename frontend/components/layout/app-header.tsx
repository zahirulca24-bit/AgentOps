import React, { useEffect, useState } from 'react';
import { usePathname } from '@/lib/router';
import { getNavigationItemByPath } from '@/components/navigation/navigation-config';
import { StatusIndicator, ThemeToggle } from '@/components/ui';
import { Bell, Menu } from 'lucide-react';
import { browserWorkersApi } from '@/lib/browser-workers-api';

export interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  isMobileMenuOpen?: boolean;
}

export function AppHeader({ onOpenMobileMenu, isMobileMenuOpen = false }: AppHeaderProps) {
  const pathname = usePathname();
  const currentItem = getNavigationItemByPath(pathname);
  const pageTitle = currentItem?.label || 'AgentOps';
  const [workerAlerts, setWorkerAlerts] = useState(0);

  const loadWorkerAlerts = async () => {
    try {
      const result = await browserWorkersApi.listNotifications(true);
      setWorkerAlerts(result.data.length);
    } catch {
      setWorkerAlerts(0);
    }
  };

  useEffect(() => {
    void loadWorkerAlerts();
    const interval = window.setInterval(() => void loadWorkerAlerts(), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const acknowledgeWorkerAlerts = async () => {
    if (!workerAlerts) return;
    try {
      await browserWorkersApi.markNotificationsRead();
      setWorkerAlerts(0);
    } catch {}
  };

  return (
    <header
      id="agentops-app-header"
      className="h-14 border-b border-border bg-surface/90 backdrop-blur-xs px-4 sm:px-6 flex items-center justify-between shrink-0 z-20"
      aria-label="Application Header"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="Open navigation menu"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline-block text-xs font-mono text-muted-foreground">ops /</span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">{pageTitle}</h2>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <button
          type="button"
          onClick={() => void acknowledgeWorkerAlerts()}
          className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label={`${workerAlerts} unread Browser Worker alerts`}
          title={workerAlerts ? `${workerAlerts} important Browser Worker failure alert${workerAlerts === 1 ? '' : 's'} — click to acknowledge` : 'No unread Browser Worker alerts'}
        >
          <Bell className="h-5 w-5" />
          {workerAlerts > 0 && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground">{workerAlerts}</span>}
        </button>
        <div className="hidden sm:flex items-center px-2.5 py-1 rounded-md bg-surface-muted border border-border text-xs" title="Static System State: Operational">
          <StatusIndicator status="idle" label="System: Ready" showPulse={false} />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

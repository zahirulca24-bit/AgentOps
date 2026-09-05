import React from 'react';
import { usePathname } from '@/lib/router';
import { getNavigationItemByPath } from '@/components/navigation/navigation-config';
import { StatusIndicator, ThemeToggle } from '@/components/ui';
import { Menu } from 'lucide-react';

export interface AppHeaderProps {
  onOpenMobileMenu: () => void;
  isMobileMenuOpen?: boolean;
}

export function AppHeader({ onOpenMobileMenu, isMobileMenuOpen = false }: AppHeaderProps) {
  const pathname = usePathname();
  const currentItem = getNavigationItemByPath(pathname);
  const pageTitle = currentItem?.label || 'AgentOps';

  return (
    <header
      id="agentops-app-header"
      className="h-14 border-b border-border bg-surface/90 backdrop-blur-xs px-4 sm:px-6 flex items-center justify-between shrink-0 z-20"
      aria-label="Application Header"
    >
      {/* Left: Mobile Menu Trigger + Page Context */}
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
          <span className="hidden sm:inline-block text-xs font-mono text-muted-foreground">
            ops /
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
            {pageTitle}
          </h2>
        </div>
      </div>

      {/* Right: Static System Status + Theme Control */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Restrained static Status Area (Prompt 3 mandate: clearly static UI) */}
        <div
          className="hidden sm:flex items-center px-2.5 py-1 rounded-md bg-surface-muted border border-border text-xs"
          title="Static System State: Operational"
        >
          <StatusIndicator status="idle" label="System: Ready" showPulse={false} />
        </div>

        {/* Theme switcher */}
        <ThemeToggle />
      </div>
    </header>
  );
}

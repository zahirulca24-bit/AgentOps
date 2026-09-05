import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { usePathname, Link } from '@/lib/router';
import {
  MAIN_NAVIGATION,
  SYSTEM_NAVIGATION,
  type NavigationItem,
} from '@/components/navigation/navigation-config';
import { Separator } from '@/components/ui';
import { X, Bot } from 'lucide-react';

export interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      // Focus close button on open
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isItemActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const renderItem = (item: NavigationItem) => {
    const active = isItemActive(item.href);
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus relative',
            active
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
          )}
        >
          {active && (
            <span
              className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r"
              aria-hidden="true"
            />
          )}

          <Icon
            className={cn(
              'w-4 h-4 shrink-0',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
            aria-hidden="true"
          />

          <div className="flex flex-col min-w-0">
            <span className="truncate">{item.label}</span>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-surface border-r border-border shadow-xl flex flex-col z-50 focus:outline-none animate-in slide-in-from-left duration-200">
        {/* Drawer Header with Brand & Close Button */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground leading-none">
                AgentOps
              </span>
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 leading-none">
                AI QA Control Center
              </span>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Mobile Main Navigation">
          <ul className="space-y-1">
            {MAIN_NAVIGATION.map((item) => renderItem(item))}
          </ul>
        </nav>

        {/* System Navigation (Settings) */}
        <div className="p-3 border-t border-border space-y-1 shrink-0">
          <ul className="space-y-1" aria-label="Mobile System Navigation">
            {SYSTEM_NAVIGATION.map((item) => renderItem(item))}
          </ul>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { cn } from '@/lib/utils';
import { usePathname, Link } from '@/lib/router';
import {
  MAIN_NAVIGATION,
  SYSTEM_NAVIGATION,
  type NavigationItem,
} from '@/components/navigation/navigation-config';
import { Tooltip, Separator } from '@/components/ui';
import { PanelLeftClose, PanelLeft, Bot } from 'lucide-react';
import { motion } from 'motion/react';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export function Sidebar({ collapsed, onToggleCollapse, className }: SidebarProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: NavigationItem) => {
    const active = isItemActive(item.href);
    const Icon = item.icon;

    const linkContent = (
      <Link
        href={item.href}
        className={cn(
          'group flex items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus relative',
          collapsed ? 'justify-center p-2.5 w-10 h-10 mx-auto' : 'px-3 py-2 w-full',
          active
            ? 'text-primary font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
        )}
        aria-label={collapsed ? item.label : undefined}
      >
        {active && (
          <motion.div
            layoutId="sidebar-active-bg"
            className="absolute inset-0 bg-primary/10 rounded-md"
            initial={false}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            aria-hidden="true"
          />
        )}
        
        {/* Active accent edge for expanded view */}
        {active && !collapsed && (
          <motion.span
            layoutId="sidebar-active-edge"
            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r z-10"
            initial={false}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            aria-hidden="true"
          />
        )}

        <Icon
          className={cn(
            'shrink-0 transition-transform duration-150 relative z-10',
            collapsed ? 'w-5 h-5' : 'w-4 h-4 mr-3',
            active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
          )}
          aria-hidden="true"
        />
        {!collapsed && (
          <span className="truncate relative z-10">{item.label}</span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <li key={item.href} className="relative">
          <Tooltip content={item.label} position="right">
            {linkContent}
          </Tooltip>
        </li>
      );
    }
    return <li key={item.href} className="relative">{linkContent}</li>;
  };

  return (
    <aside
      id="agentops-sidebar"
      aria-label="Sidebar Navigation"
      className={cn(
        'hidden md:flex flex-col shrink-0 bg-surface border-r border-border transition-[width] duration-300 ease-in-out select-none relative z-30',
        collapsed ? 'w-16' : 'w-60',
        className
      )}
    >
      {/* Brand Section */}
      <div
        className={cn(
          'h-14 border-b border-border flex items-center shrink-0 px-3',
          collapsed ? 'justify-center' : 'justify-between px-4'
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md py-1"
          aria-label="AgentOps Home"
        >
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground shadow-xs shrink-0">
            <Bot className="w-4 h-4" />
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground leading-none">
                AgentOps
              </span>
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 leading-none truncate">
                AI QA Control Center
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Main Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1" aria-label="Main Navigation">
        <ul className="space-y-1">
          {MAIN_NAVIGATION.map((item) => renderNavItem(item))}
        </ul>
      </nav>

      {/* Lower Section: Separator + Settings + Collapse Toggle */}
      <div className="p-2 border-t border-border/80 space-y-1 shrink-0">
        <ul className="space-y-1" aria-label="System Navigation">
          {SYSTEM_NAVIGATION.map((item) => renderNavItem(item))}
        </ul>

        <Separator className="my-1.5 opacity-60" />

        {/* Desktop Collapse / Expand Button */}
        {collapsed ? (
          <Tooltip content="Expand Sidebar" position="right">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="w-10 h-10 mx-auto flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="text-muted-foreground">Collapse Sidebar</span>
            <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </aside>
  );
}

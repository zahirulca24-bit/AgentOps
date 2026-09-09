import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from './sidebar';
import { AppHeader } from './app-header';
import { MobileNavigation } from './mobile-navigation';
import { usePathname } from '@/lib/router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Toaster } from 'sonner';
import { useTheme } from '@/lib/theme';
import { GlobalCommandChat } from '@/components/command-chat';

export interface AppShellProps {
  children: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'agentops_sidebar_collapsed';

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Continue without persistence when storage is unavailable.
      }
      return next;
    });
  };

  return (
    <div
      id="agentops-app-shell"
      className="min-h-screen bg-background text-foreground flex flex-row h-screen w-full overflow-hidden antialiased"
    >
      <a
        href="#agentops-main-content-scroll"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus:ring-2 focus:ring-focus"
      >
        Skip to main content
      </a>

      <Sidebar collapsed={collapsed} onToggleCollapse={handleToggleCollapse} />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <AppHeader
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        <main
          ref={mainRef}
          id="agentops-main-content-scroll"
          className="flex-1 overflow-y-auto min-w-0 bg-background focus:outline-none"
          tabIndex={-1}
          aria-label="Main content"
        >
          <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <MobileNavigation isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <GlobalCommandChat />

      <Toaster
        theme={theme === 'dark' ? 'dark' : 'light'}
        position="bottom-right"
        className="font-sans"
        toastOptions={{
          className: 'bg-surface border-border text-foreground',
          descriptionClassName: 'text-muted-foreground',
        }}
      />
    </div>
  );
}

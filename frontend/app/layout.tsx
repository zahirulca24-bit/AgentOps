import React from 'react';
import { ThemeProvider } from '@/lib/theme';
import { NavigationProvider } from '@/lib/router';
import { AppShell } from '@/components/layout';
import './globals.css';

export interface Metadata {
  title: string;
  description: string;
}

export const metadata: Metadata = {
  title: 'AgentOps',
  description: 'AI-powered QA & Software Operations Control Center',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider defaultTheme="dark">
      <NavigationProvider>
        <AppShell>
          {children}
        </AppShell>
      </NavigationProvider>
    </ThemeProvider>
  );
}

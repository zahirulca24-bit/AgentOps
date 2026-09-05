/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import RootLayout from '@/app/layout';
import { usePathname } from '@/lib/router';
import DashboardPage from '@/app/page';
import CommandCenterPage from '@/app/command/page';
import BrowserSessionsPage from '@/app/sessions/page';
import TestRunsPage from '@/app/runs/page';
import IssuesPage from '@/app/issues/page';
import ReportsPage from '@/app/reports/page';
import SettingsPage from '@/app/settings/page';
import AutomationPage from '@/app/automation/page';
import AgentPage from '@/app/agent/page';
import { NotFoundPage } from '@/components/layout/not-found-page';

function RouteContent() {
  const pathname = usePathname();

  if (pathname === '/automation' || pathname.startsWith('/automation/')) return <AutomationPage />;
  if (pathname === '/agent' || pathname.startsWith('/agent/')) return <AgentPage />;
  if (pathname === '/command' || pathname.startsWith('/command/')) {
    return <CommandCenterPage />;
  }
  if (pathname === '/sessions' || pathname.startsWith('/sessions/')) {
    return <BrowserSessionsPage />;
  }
  if (pathname === '/runs' || pathname.startsWith('/runs/')) {
    return <TestRunsPage />;
  }
  if (pathname === '/issues' || pathname.startsWith('/issues/')) {
    return <IssuesPage />;
  }
  if (pathname === '/reports' || pathname.startsWith('/reports/')) {
    return <ReportsPage />;
  }
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return <SettingsPage />;
  }

  if (pathname === '/' || pathname === '') return <DashboardPage />;

  return <NotFoundPage />;
}

export default function App() {
  return (
    <RootLayout>
      <RouteContent />
    </RootLayout>
  );
}

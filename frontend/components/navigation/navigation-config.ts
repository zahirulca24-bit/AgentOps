import {
  LayoutDashboard,
  Terminal,
  Workflow,
  BrainCircuit,
  Globe,
  FlaskConical,
  AlertCircle,
  FileBarChart,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type NavigationSection = 'main' | 'system';

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavigationSection;
  description: string;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    section: 'main',
    description: 'System overview, test suite telemetry, and operational health.',
  },
  {
    label: 'Command Center',
    href: '/command',
    icon: Terminal,
    section: 'main',
    description: 'Natural language QA orchestration and autonomous agent dispatch.',
  },
  {
    label: 'AI Automation',
    href: '/automation',
    icon: Workflow,
    section: 'main',
    description: 'Visual builder for autonomous workflow execution pipelines.',
  },
  {
    label: 'AI Agent',
    href: '/agent',
    icon: BrainCircuit,
    section: 'main',
    description: 'Autonomous control center for QA and connected tools.',
  },
  {
    label: 'Browser Workers',
    href: '/sessions',
    icon: Globe,
    section: 'main',
    description: 'Run and monitor secure autonomous browser workers.',
  },

  {
    label: 'Test Runs',
    href: '/runs',
    icon: FlaskConical,
    section: 'main',
    description: 'Automated test execution suites, traces, and step assertions.',
  },
  {
    label: 'Issues',
    href: '/issues',
    icon: AlertCircle,
    section: 'main',
    description: 'Autonomous bug detection, triage, and regression tracking.',
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: FileBarChart,
    section: 'main',
    description: 'Compliance audits, coverage heatmaps, and test run summaries.',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    section: 'system',
    description: 'Workspace preferences, agent configurations, and integrations.',
  },
];

export const MAIN_NAVIGATION = NAVIGATION_ITEMS.filter((item) => item.section === 'main');
export const SYSTEM_NAVIGATION = NAVIGATION_ITEMS.filter((item) => item.section === 'system');

export function getNavigationItemByPath(pathname: string): NavigationItem | undefined {
  if (pathname === '/' || pathname === '') {
    return NAVIGATION_ITEMS.find((item) => item.href === '/');
  }
  return NAVIGATION_ITEMS.find((item) => item.href !== '/' && pathname.startsWith(item.href));
}

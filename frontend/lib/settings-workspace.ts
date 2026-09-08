export type IntegrationStatus = 'connected' | 'disconnected';

export type Integration = {
  id: 'github' | 'render' | 'vercel' | 'netlify' | 'telegram' | 'email';
  name: string;
  description: string;
  status: IntegrationStatus;
  secretRef: string;
  permissions: string[];
};

export const SETTINGS_TABS = ['General', 'Integrations', 'Permissions', 'Credentials', 'Notifications'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const INITIAL_INTEGRATIONS: Integration[] = [
  { id: 'github', name: 'GitHub', description: 'Repository access, pull requests, and checks.', status: 'connected', secretRef: 'vault://integrations/github/primary', permissions: ['Read repositories', 'Create pull requests'] },
  { id: 'render', name: 'Render', description: 'Deploy previews and read service health.', status: 'connected', secretRef: 'vault://integrations/render/primary', permissions: ['Read services', 'Trigger previews'] },
  { id: 'vercel', name: 'Vercel', description: 'Manage preview deployments and build status.', status: 'disconnected', secretRef: 'vault://integrations/vercel/primary', permissions: ['Read deployments'] },
  { id: 'netlify', name: 'Netlify', description: 'Inspect deploys and site build output.', status: 'disconnected', secretRef: 'vault://integrations/netlify/primary', permissions: ['Read deploys'] },
  { id: 'telegram', name: 'Telegram', description: 'Deliver approval requests and operational alerts.', status: 'disconnected', secretRef: 'vault://integrations/telegram/alerts', permissions: ['Send approved notifications'] },
  { id: 'email', name: 'Email', description: 'Send security and run-completion notifications.', status: 'connected', secretRef: 'vault://integrations/email/notifications', permissions: ['Send approved notifications'] },
];

export function toggleIntegration(integrations: Integration[], id: Integration['id']): Integration[] {
  return integrations.map((integration) => integration.id === id
    ? { ...integration, status: integration.status === 'connected' ? 'disconnected' : 'connected' }
    : integration
  );
}

export function connectionAuditEntry(integration: Integration, action: 'connected' | 'disconnected' | 'tested'): string {
  const verb = action === 'tested' ? 'Connection check completed' : `Integration ${action}`;
  return `${verb}: ${integration.name} · credential reference ${integration.secretRef}`;
}

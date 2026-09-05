import React from 'react';
import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Workspace preferences, agent configurations, and integrations."
      promptNote="This workspace will be implemented in a later frontend prompt."
      icon={Settings}
    />
  );
}

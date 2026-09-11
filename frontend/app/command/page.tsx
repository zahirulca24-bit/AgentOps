'use client';

import React, { useState } from 'react';
import {
  CommandHeader,
  TargetUrlInput,
  CommandComposer,
  CommandOptionsCard,
  RunSummaryCard,
  RecentCommandsList,
  SafetyNotice,
  StagedDispatchBanner,
  MissionControl,
} from '@/components/command';
import { Card, CardContent } from '@/components/ui';
import {
  DEFAULT_QA_OPTIONS,
  validateTargetUrl,
  validateCommandPrompt,
} from '@/lib/command-presets';
import {
  QAOptionsState,
  CommandPreset,
  StagedDispatchPayload,
  QAOptionKey,
} from '@/types';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';

export default function CommandCenterPage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [options, setOptions] = useState<QAOptionsState>({ ...DEFAULT_QA_OPTIONS });
  const [urlTouched, setUrlTouched] = useState<boolean>(false);
  const [promptTouched, setPromptTouched] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [stagedPayload, setStagedPayload] = useState<StagedDispatchPayload | null>(null);

  // Validation
  const urlError = urlTouched || targetUrl.length > 0 ? validateTargetUrl(targetUrl) : null;
  const promptError = promptTouched || prompt.length > 0 ? validateCommandPrompt(prompt) : null;
  const hasOptionsEnabled = Object.values(options).some(Boolean);

  const isValid =
    !validateTargetUrl(targetUrl) &&
    !validateCommandPrompt(prompt) &&
    hasOptionsEnabled;

  const handleUrlChange = (val: string) => {
    setTargetUrl(val);
    if (!urlTouched) setUrlTouched(true);
    if (stagedPayload) setStagedPayload(null);
  };

  const handlePromptChange = (val: string) => {
    setPrompt(val);
    if (!promptTouched) setPromptTouched(true);
    if (stagedPayload) setStagedPayload(null);
  };

  const handleSelectPreset = (preset: CommandPreset) => {
    setTargetUrl(preset.targetUrl);
    setPrompt(preset.prompt);
    setOptions({ ...preset.options });
    setUrlTouched(true);
    setPromptTouched(true);
    if (stagedPayload) setStagedPayload(null);
    toast.success('Preset loaded', {
      description: preset.title
    });
  };

  const handleResetForm = () => {
    setTargetUrl('');
    setPrompt('');
    setOptions({ ...DEFAULT_QA_OPTIONS });
    setUrlTouched(false);
    setPromptTouched(false);
    setStagedPayload(null);
  };

  const handleSubmit = async () => {
    setUrlTouched(true); setPromptTouched(true);
    const targetErr=validateTargetUrl(targetUrl); const promptErr=validateCommandPrompt(prompt);
    if(targetErr||promptErr||!hasOptionsEnabled){toast.error('Validation failed',{description:'Please correct the highlighted errors before dispatching.'});return;}
    setIsSubmitting(true); setStagedPayload(null);
    try {
      const project=await api.createProject(`QA ${new URL(targetUrl).hostname}`,targetUrl.trim());
      const task=await api.createTask(project.data.id,prompt.trim(),targetUrl.trim());
      const result=await api.executeTask(task.data.id);
      toast.success('QA run started asynchronously',{description:`Run ${result.data.run.id} is executing live`});
      router.push(`/runs/${result.data.run.id}`);
    } catch(error) {
      toast.error('Backend run failed',{description:error instanceof Error?error.message:'Unknown error'});
    } finally { setIsSubmitting(false); }
  };

  const hasAnyInput = Boolean(targetUrl.trim() || prompt.trim());

  return (
    <div
      id="agentops-command-center"
      className="space-y-6 sm:space-y-8 animate-in fade-in duration-150"
    >
      <MissionControl />

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-foreground marker:content-none">
          Website Tester
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">Open tester</span>
          <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Hide tester</span>
        </summary>
        <div className="border-t border-border p-4 sm:p-6">
          <CommandHeader onReset={handleResetForm} hasInput={hasAnyInput} />
          {stagedPayload && <div className="mt-6"><StagedDispatchBanner payload={stagedPayload} onDismiss={() => setStagedPayload(null)} /></div>}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Target URL + Primary Command Composer + QA Options (2 Cols) */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Main Formulation Card */}
          <Card className="border-border bg-surface shadow-xs">
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Target URL field */}
              <TargetUrlInput
                value={targetUrl}
                onChange={handleUrlChange}
                error={urlError}
                disabled={isSubmitting}
              />

              <div className="border-t border-border" />

              {/* Natural Language Prompt Composer */}
              <CommandComposer
                value={prompt}
                onChange={handlePromptChange}
                onSubmit={handleSubmit}
                error={promptError}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          {/* QA Options Section */}
          <CommandOptionsCard
            options={options}
            onChange={setOptions}
            disabled={isSubmitting}
          />
        </div>

        {/* Right Column: Pre-Flight Run Summary + Safety Notice (1 Col) */}
        <div className="lg:col-span-1 space-y-6 min-w-0">
          <RunSummaryCard
            targetUrl={targetUrl}
            prompt={prompt}
            options={options}
            isSubmitting={isSubmitting}
            isValid={isValid}
            onSubmit={handleSubmit}
            onClear={handleResetForm}
          />

          <SafetyNotice />
        </div>
          </div>
          <section className="mt-6" aria-label="Recent Commands and Presets">
        <RecentCommandsList
          onSelectPreset={handleSelectPreset}
          disabled={isSubmitting}
        />
          </section>
        </div>
      </details>
    </div>
  );
}

import React, { useState } from 'react';
import { BrowserSession } from '@/types';
import { SessionHeader } from './session-header';
import { ExecutionStages } from './execution-stages';
import { BrowserPreview } from './browser-preview';
import { ActivityFeed } from './activity-feed';
import { ConsolePanel } from './console-panel';
import { NetworkPanel } from './network-panel';
import { EvidencePanel } from './evidence-panel';
import { Card, CardContent } from '@/components/ui';
import {
  Activity,
  Terminal,
  Wifi,
  Camera,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SessionWorkspaceProps {
  initialSession: BrowserSession;
}

type TabKey = 'activity' | 'console' | 'network' | 'evidence';

export function SessionWorkspace({ initialSession }: SessionWorkspaceProps) {
  const [session, setSession] = useState<BrowserSession>(initialSession);
  const [isPaused, setIsPaused] = useState<boolean>(initialSession.status === 'paused');
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('activity');

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    setActionNotice(
      nextPaused
        ? 'Simulation: Run paused by operator (Frontend Isolated UI State)'
        : 'Simulation: Run resumed by operator (Frontend Isolated UI State)'
    );
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleStop = () => {
    setIsStopped(true);
    setIsPaused(false);
    setActionNotice(
      'Simulation: Operator dispatched emergency stop signal. (Consequential Action - Frontend Isolated)'
    );
    setTimeout(() => setActionNotice(null), 5000);
  };

  const consoleErrors = session.consoleLogs.filter((l) => l.level === 'error').length;
  const networkErrors = session.networkLogs.filter((l) => l.hasError || l.status >= 400).length;

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
      {/* 1. Header with Targets, Status, and Pause/Stop Controls */}
      <SessionHeader
        id={session.id}
        targetUrl={session.targetUrl}
        targetHost={session.targetHost}
        status={isStopped ? 'stopped' : isPaused ? 'paused' : session.status}
        duration={session.duration}
        startedAt={session.startedAt}
        isPaused={isPaused}
        isStopped={isStopped}
        onTogglePause={handleTogglePause}
        onStop={handleStop}
      />

      {/* Action Notification Banner (Explicitly frontend isolated) */}
      {actionNotice && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-xs text-primary flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-medium">
            <Info className="w-4 h-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Execution Pipeline Stages Stepper */}
      <ExecutionStages
        stages={session.stages}
        currentStage={isStopped ? 'Testing' : session.currentStage}
      />

      {/* 3. Main Split Execution Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left / Primary Column: Browser Preview (7 cols on XL) */}
        <div className="xl:col-span-7 space-y-4 min-w-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] font-mono">
              Live Browser Viewport
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Chromium Headless Sandbox
            </span>
          </div>

          <BrowserPreview session={session} />

          {/* Test Objective Context Box */}
          <div className="p-3.5 rounded-lg border border-border bg-surface-muted/30 text-xs space-y-1">
            <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold tracking-wider block">
              Active Test Instruction Prompt
            </span>
            <p className="text-foreground leading-relaxed">
              {session.prompt}
            </p>
          </div>
        </div>

        {/* Right Column: Interactive Diagnostics Tabs & Activity (5 cols on XL) */}
        <div className="xl:col-span-5 space-y-4 min-w-0">
          <Card className="border-border bg-surface shadow-2xs">
            {/* Diagnostics Navigation Tabs */}
            <div className="border-b border-border p-2 bg-surface-muted/40">
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={cn(
                    'py-2 px-1.5 rounded-md text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 text-center',
                    activeTab === 'activity'
                      ? 'bg-surface text-foreground font-semibold shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  )}
                >
                  <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">Activity</span>
                  <span className="text-[10px] font-mono opacity-80">
                    ({session.events.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('console')}
                  className={cn(
                    'py-2 px-1.5 rounded-md text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 text-center',
                    activeTab === 'console'
                      ? 'bg-surface text-foreground font-semibold shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  )}
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Console</span>
                  {consoleErrors > 0 ? (
                    <span className="text-[10px] font-mono px-1 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
                      {consoleErrors}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono opacity-80">
                      ({session.consoleLogs.length})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('network')}
                  className={cn(
                    'py-2 px-1.5 rounded-md text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 text-center',
                    activeTab === 'network'
                      ? 'bg-surface text-foreground font-semibold shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  )}
                >
                  <Wifi className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span className="truncate">Network</span>
                  {networkErrors > 0 ? (
                    <span className="text-[10px] font-mono px-1 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
                      {networkErrors}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono opacity-80">
                      ({session.networkLogs.length})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('evidence')}
                  className={cn(
                    'py-2 px-1.5 rounded-md text-xs font-medium transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 text-center',
                    activeTab === 'evidence'
                      ? 'bg-surface text-foreground font-semibold shadow-xs border border-border/80'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                  )}
                >
                  <Camera className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="truncate">Evidence</span>
                  <span className="text-[10px] font-mono opacity-80">
                    ({session.evidence.length})
                  </span>
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <CardContent className="p-4 sm:p-5">
              {activeTab === 'activity' && (
                <ActivityFeed events={session.events} />
              )}
              {activeTab === 'console' && (
                <ConsolePanel logs={session.consoleLogs} />
              )}
              {activeTab === 'network' && (
                <NetworkPanel logs={session.networkLogs} />
              )}
              {activeTab === 'evidence' && (
                <EvidencePanel evidence={session.evidence} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

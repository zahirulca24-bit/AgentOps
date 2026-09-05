import React, { useState } from 'react';
import { BrowserSession, SessionStatus } from '@/types';
import { PREVIEW_SESSIONS } from '@/lib/mock-sessions';
import { Link } from '@/lib/router';
import {
  Globe,
  Clock,
  ArrowRight,
  Plus,
  Search,
  Filter,
  Layers,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Square,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge, Input, Card, CardContent, StatusIndicator } from '@/components/ui';

export interface SessionsListProps {
  sessions?: BrowserSession[];
}

export function SessionsList({ sessions = PREVIEW_SESSIONS }: SessionsListProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const completedCount = sessions.filter((s) => s.status === 'completed').length;
  const failedCount = sessions.filter((s) => s.status === 'failed').length;

  const filteredSessions = sessions.filter((s) => {
    if (filterStatus !== 'all' && s.status !== filterStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.id.toLowerCase().includes(q) ||
        s.targetHost.toLowerCase().includes(q) ||
        s.targetUrl.toLowerCase().includes(q) ||
        s.prompt.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="info" size="sm" withDot>
            Running
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" size="sm" withDot>
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger" size="sm" withDot>
            Failed
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="warning" size="sm" withDot>
            Paused
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Header with Title & Launch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Browser Sessions
            </h1>
            <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded bg-surface-muted border border-border text-muted-foreground">
              Live Inspection
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Observe autonomous headless browser sessions, inspect action timelines, and trace live diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Link href="/command">
            <Button
              variant="primary"
              size="sm"
              className="text-xs h-9 shadow-xs"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New QA Session
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Top Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">
            Total Sessions
          </span>
          <div className="text-xl font-bold font-mono text-foreground">
            {sessions.length}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-muted-foreground">
              Active Running
            </span>
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
          </div>
          <div className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">
            {runningCount}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">
            Completed
          </span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {completedCount}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border bg-surface shadow-2xs space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">
            Failed / Defect
          </span>
          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {failedCount}
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: `All (${sessions.length})` },
            { id: 'running', label: `Running (${runningCount})` },
            { id: 'completed', label: `Completed (${completedCount})` },
            { id: 'failed', label: `Failed (${failedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0',
                filterStatus === tab.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'bg-surface-muted text-muted-foreground hover:text-foreground border border-border/70'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or domain..."
            className="h-9 text-xs font-mono"
            leftIcon={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* 4. Sessions Table / Card List */}
      <div className="border border-border rounded-xl bg-surface overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-[11px] font-mono text-muted-foreground uppercase font-semibold">
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">Target Host / URL</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4">Started</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No browser sessions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((ses) => (
                  <tr
                    key={ses.id}
                    className="hover:bg-surface-muted/40 transition-colors group"
                  >
                    {/* Session ID */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-foreground whitespace-nowrap">
                      <Link
                        href={`/sessions/${ses.id}`}
                        className="text-primary hover:underline"
                      >
                        {ses.id}
                      </Link>
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5 min-w-[180px] max-w-sm">
                        <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                          <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{ses.targetHost}</span>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          {ses.targetUrl}
                        </p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(ses.status)}
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-muted border border-border text-foreground">
                        {ses.currentStage}
                      </span>
                    </td>

                    {/* Started Time */}
                    <td className="py-3.5 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {ses.startedAt}
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-4 font-mono text-foreground font-medium whitespace-nowrap">
                      {ses.duration}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link href={`/sessions/${ses.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-primary group-hover:translate-x-0.5 transition-transform"
                          rightIcon={<ArrowRight className="w-3 h-3" />}
                        >
                          Inspect Live
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

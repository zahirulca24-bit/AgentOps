import React from 'react';
import { Button, Badge } from '@/components/ui';
import { SessionStatus } from '@/types';
import { Link } from '@/lib/router';
import {
  ArrowLeft,
  Globe,
  Clock,
  Pause,
  Play,
  Square,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SessionHeaderProps {
  id: string;
  targetUrl: string;
  targetHost: string;
  status: SessionStatus;
  duration: string;
  startedAt: string;
  isPaused: boolean;
  isStopped: boolean;
  onTogglePause: () => void;
  onStop: () => void;
}

export function SessionHeader({
  id,
  targetUrl,
  targetHost,
  status,
  duration,
  startedAt,
  isPaused,
  isStopped,
  onTogglePause,
  onStop,
}: SessionHeaderProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyId = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = () => {
    if (isStopped) {
      return (
        <Badge variant="neutral" size="sm" withDot>
          Stopped by User
        </Badge>
      );
    }
    if (isPaused) {
      return (
        <Badge variant="warning" size="sm" withDot>
          Paused
        </Badge>
      );
    }
    switch (status) {
      case 'running':
        return (
          <Badge variant="info" size="sm" withDot dotClassName="motion-safe:animate-pulse">
            Running QA
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
            Run Failed
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
    <div className="space-y-3 pb-2 border-b border-border">
      {/* Top navigation & breadcrumb */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to All Sessions</span>
        </Link>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline-block">
            Started: {startedAt}
          </span>
        </div>
      </div>

      {/* Main header row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Target URL & ID info */}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2 truncate">
              <Globe className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{targetHost}</span>
            </h1>

            {/* Session ID chip with copy button */}
            <button
              type="button"
              onClick={handleCopyId}
              title="Click to copy Session ID"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-muted border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-surface-muted/80 transition-colors"
            >
              <span>{id}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 opacity-60" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className="truncate max-w-md sm:max-w-xl text-[11px]">
              {targetUrl}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3" />
              Duration: <strong className="text-foreground">{duration}</strong>
            </span>
          </div>
        </div>

        {/* Right: Operator Action Controls (Pause / Consequential Stop) */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          {/* Pause / Resume button */}
          <Button
            variant="outline"
            size="sm"
            disabled={isStopped || status === 'completed'}
            onClick={onTogglePause}
            className="text-xs h-9"
            leftIcon={
              isPaused ? (
                <Play className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )
            }
          >
            <span>{isPaused ? 'Resume Run' : 'Pause'}</span>
          </Button>

          {/* Stop Run Consequential Action */}
          <Button
            variant="danger"
            size="sm"
            disabled={isStopped || status === 'completed'}
            onClick={onStop}
            className="text-xs h-9 shadow-xs"
            leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
          >
            <span>{isStopped ? 'Session Stopped' : 'Stop Run'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

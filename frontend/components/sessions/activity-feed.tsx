import React, { useState } from 'react';
import { SessionEvent, SessionEventType } from '@/types';
import {
  Compass,
  MousePointerClick,
  FileEdit,
  CheckCircle2,
  Camera,
  Terminal,
  Activity,
  Cpu,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Input } from '@/components/ui';

export interface ActivityFeedProps {
  events: SessionEvent[];
  className?: string;
}

export function ActivityFeed({ events, className }: ActivityFeedProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const getEventIcon = (type: SessionEventType) => {
    switch (type) {
      case 'navigation':
        return <Compass className="w-3.5 h-3.5 text-sky-500" />;
      case 'click':
        return <MousePointerClick className="w-3.5 h-3.5 text-primary" />;
      case 'input':
        return <FileEdit className="w-3.5 h-3.5 text-emerald-500" />;
      case 'assertion':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'screenshot':
        return <Camera className="w-3.5 h-3.5 text-purple-500" />;
      case 'console':
        return <Terminal className="w-3.5 h-3.5 text-amber-500" />;
      case 'network':
        return <Activity className="w-3.5 h-3.5 text-rose-500" />;
      case 'system':
      default:
        return <Cpu className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: SessionEvent['status']) => {
    switch (status) {
      case 'error':
        return <Badge variant="danger" size="sm">Error</Badge>;
      case 'warning':
        return <Badge variant="warning" size="sm">Warn</Badge>;
      case 'success':
        return <Badge variant="success" size="sm">OK</Badge>;
      case 'info':
      default:
        return <Badge variant="neutral" size="sm">Info</Badge>;
    }
  };

  const filteredEvents = events.filter((evt) => {
    if (filterType !== 'all' && evt.type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        evt.description.toLowerCase().includes(q) ||
        evt.type.toLowerCase().includes(q) ||
        evt.details?.selector?.toLowerCase().includes(q) ||
        evt.details?.url?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className={cn('flex flex-col h-full space-y-3', className)}>
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'assertion', 'click', 'input', 'network', 'console'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterType(cat)}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-mono capitalize transition-colors shrink-0',
                filterType === cat
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'bg-surface-muted/60 text-muted-foreground hover:text-foreground border border-border/70'
              )}
            >
              {cat === 'all' ? `All (${events.length})` : cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[160px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter events..."
            className="h-7 text-xs font-mono"
            leftIcon={<Search className="w-3 h-3 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Events Timeline Container */}
      <div className="flex-1 overflow-y-auto max-h-[520px] pr-1 space-y-2 font-sans">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            No events match the current filter.
          </div>
        ) : (
          <ol className="relative border-l border-border/80 ml-3 space-y-2.5">
            {filteredEvents.map((evt) => (
              <li key={evt.id} className="relative pl-4 text-xs group">
                {/* Timeline node icon */}
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-surface border border-border flex items-center justify-center shadow-2xs">
                  {getEventIcon(evt.type)}
                </div>

                {/* Event Card */}
                <div
                  className={cn(
                    'p-2.5 rounded-lg border transition-colors',
                    evt.status === 'error'
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : evt.status === 'warning'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border bg-surface-muted/30 hover:bg-surface-muted/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {evt.timestamp}
                      </span>
                      <span>({evt.relativeTime})</span>
                      <span className="uppercase px-1.5 py-0.2 rounded bg-surface border border-border/70 text-[9px]">
                        {evt.type}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(evt.status)}
                    </div>
                  </div>

                  <p className="text-foreground leading-relaxed font-medium">
                    {evt.description}
                  </p>

                  {/* Selector or URL Details Pill */}
                  {evt.details && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/60 flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground">
                      {evt.details.selector && (
                        <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-foreground">
                          Selector: {evt.details.selector}
                        </span>
                      )}
                      {evt.details.url && (
                        <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-foreground truncate max-w-xs">
                          URL: {evt.details.url}
                        </span>
                      )}
                      {evt.details.value && (
                        <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-foreground">
                          Value: &ldquo;{evt.details.value}&rdquo;
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { NetworkEvent } from '@/types';
import { Activity, AlertCircle, ArrowUpRight, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Input } from '@/components/ui';

export interface NetworkPanelProps {
  logs: NetworkEvent[];
  className?: string;
}

export function NetworkPanel({ logs, className }: NetworkPanelProps) {
  const [filterFailedOnly, setFilterFailedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const failedCount = logs.filter((n) => n.hasError || n.status >= 400).length;

  const filteredLogs = logs.filter((item) => {
    if (filterFailedOnly && !(item.hasError || item.status >= 400)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.url.toLowerCase().includes(q) ||
        item.method.toLowerCase().includes(q) ||
        item.status.toString().includes(q)
      );
    }
    return true;
  });

  const getMethodBadge = (method: NetworkEvent['method']) => {
    switch (method) {
      case 'GET':
        return <Badge variant="info" size="sm" className="font-mono text-[10px] uppercase">GET</Badge>;
      case 'POST':
        return <Badge variant="success" size="sm" className="font-mono text-[10px] uppercase">POST</Badge>;
      case 'PUT':
      case 'PATCH':
        return <Badge variant="warning" size="sm" className="font-mono text-[10px] uppercase">{method}</Badge>;
      case 'DELETE':
        return <Badge variant="danger" size="sm" className="font-mono text-[10px] uppercase">DEL</Badge>;
      default:
        return <Badge variant="neutral" size="sm" className="font-mono text-[10px] uppercase">{method}</Badge>;
    }
  };

  const getStatusBadge = (status: number, statusText: string) => {
    if (status >= 400) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-mono text-[11px] font-semibold">
          <AlertCircle className="w-3 h-3" />
          <span>{status} {statusText}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">
        {status} {statusText}
      </span>
    );
  };

  return (
    <div className={cn('space-y-3 font-mono text-xs', className)}>
      {/* Top filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterFailedOnly(false)}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] transition-colors',
              !filterFailedOnly
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-surface-muted text-muted-foreground hover:text-foreground'
            )}
          >
            All Requests ({logs.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterFailedOnly(true)}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors',
              filterFailedOnly
                ? 'bg-rose-600 text-white font-semibold'
                : 'bg-surface-muted text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
            )}
          >
            <AlertCircle className="w-3 h-3" />
            <span>Failed Only ({failedCount})</span>
          </button>
        </div>

        <div className="relative min-w-[170px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search URL or method..."
            className="h-7 text-xs font-mono"
            leftIcon={<Search className="w-3 h-3 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Network requests table/list */}
      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-[10px] text-muted-foreground uppercase font-semibold">
                <th className="py-2 px-3">Method</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">URL / Resource</th>
                <th className="py-2 px-3 text-right">Time</th>
                <th className="py-2 px-3 text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No network requests matched your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((req) => {
                  const isFail = req.hasError || req.status >= 400;

                  return (
                    <tr
                      key={req.id}
                      className={cn(
                        'transition-colors',
                        isFail
                          ? 'bg-rose-500/10 hover:bg-rose-500/15'
                          : 'hover:bg-surface-muted/50'
                      )}
                    >
                      <td className="py-2 px-3 shrink-0">
                        {getMethodBadge(req.method)}
                      </td>
                      <td className="py-2 px-3 shrink-0 whitespace-nowrap">
                        {getStatusBadge(req.status, req.statusText)}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'truncate max-w-xs sm:max-w-md block',
                              isFail ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-foreground'
                            )}
                            title={req.url}
                          >
                            {req.url}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 hidden lg:inline-block">
                            ({req.type})
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {req.duration}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {req.size || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

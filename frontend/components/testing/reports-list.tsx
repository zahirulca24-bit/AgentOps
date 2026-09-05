import React, { useState } from 'react';
import { MOCK_REPORTS, ReportContent } from '@/lib/mock-testing';
import { Badge, Button, Input } from '@/components/ui';
import { FileBarChart, Search, Download, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/router';

export function ReportsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredReports = MOCK_REPORTS.filter(report => {
    if (filterType !== 'all' && report.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return report.title.toLowerCase().includes(q) || report.id.toLowerCase().includes(q);
    }
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 shadow-xs shrink-0">
              <FileBarChart className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Reports
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Compliance audits, coverage heatmaps, and test run summaries.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Button variant="primary" size="sm" className="text-xs h-9 shadow-xs" leftIcon={<FileText className="w-4 h-4" />}>
            Generate New Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['all', 'compliance', 'coverage', 'summary'].map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 capitalize',
                filterType === type
                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                  : 'bg-surface-muted text-muted-foreground hover:text-foreground border border-border/70'
              )}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports..."
            className="h-9 text-xs font-mono"
            leftIcon={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredReports.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            No reports matched your criteria.
          </div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className="p-4 rounded-xl border border-border bg-surface shadow-2xs hover:shadow-sm transition-shadow flex flex-col space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-surface-muted border border-border flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm line-clamp-1">{report.title}</h3>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{report.type}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-muted/30 border border-border">
                <span className="text-xs font-medium text-muted-foreground">Score / Metric</span>
                <span className={cn("text-lg font-bold font-mono", getScoreColor(report.score))}>
                  {report.score}%
                </span>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
                  {report.status === 'ready' ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {report.generatedAt}</>
                  ) : (
                    <><Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin" /> Generating...</>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  <Link href={`/reports/${report.id}`} aria-label={`View report ${report.title}`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      View
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs" 
                    disabled={report.status !== 'ready'}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Export
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, Link } from '@/lib/router';
import { api, type ApiRun } from '@/lib/api';
import { Badge, Button, Card, Input } from '@/components/ui';
import { 
  ArrowLeft, 
  AlertCircle, 
  FileBarChart, 
  FileText, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Bug, 
  Camera, 
  Terminal, 
  Globe, 
  Clock, 
  Calendar, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface FormattedReport {
  run: ApiRun;
  appName: string;
  targetUrl: string;
  testDate: string;
  day: string;
  startTime: string;
  endTime: string;
  totalDuration: string;
  runId: string;
  environment: string;
  finalStatus: 'PASS' | 'FAIL' | 'DEGRADED';
  passedCount: number;
  failedCount: number;
  issuesCount: number;
  evidenceCount: number;
  consoleErrorsCount: number;
  networkErrorsCount: number;
}

function extractTargetUrl(run: ApiRun): string {
  if (run.task?.targetUrl) return run.task.targetUrl;
  if (run.task?.project?.targetUrl) return run.task.project.targetUrl;
  if (run.task?.command) {
    const match = run.task.command.match(/https?:\/\/[^\s]+/i);
    if (match) return match[0];
  }
  return 'http://localhost:3000';
}

function formatReportData(run: ApiRun): FormattedReport {
  const startedDate = new Date(run.startedAt || run.createdAt);
  const endDate = run.completedAt ? new Date(run.completedAt) : null;

  const testDate = startedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const day = startedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const startTime = startedDate.toLocaleTimeString('en-US', { hour12: false });
  const endTime = endDate ? endDate.toLocaleTimeString('en-US', { hour12: false }) : 'In Progress';

  const startMs = startedDate.getTime();
  const endMs = endDate ? endDate.getTime() : Date.now();
  const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const totalDuration = diffSec < 60 ? `${diffSec}s` : `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;

  const results = run.testResults || [];
  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => ['failed', 'error'].includes(r.status)).length;
  const issuesCount = run.issues?.length || 0;
  const evidenceCount = run.evidence?.length || 0;

  const consoleEvidenceCount = run.evidence?.filter(e => e.type === 'console_log').length || 0;
  const issueConsoleCount = run.issues?.reduce((acc, issue) => {
    const list = Array.isArray(issue.consoleEvidence) ? issue.consoleEvidence : [];
    return acc + list.length;
  }, 0) || 0;
  const consoleErrorsCount = Math.max(consoleEvidenceCount, issueConsoleCount);

  const networkEvidenceCount = run.evidence?.filter(e => e.type === 'network_log').length || 0;
  const issueNetworkCount = run.issues?.reduce((acc, issue) => {
    const list = Array.isArray(issue.networkEvidence) ? issue.networkEvidence : [];
    return acc + list.length;
  }, 0) || 0;
  const networkErrorsCount = Math.max(networkEvidenceCount, issueNetworkCount);

  let finalStatus: 'PASS' | 'FAIL' | 'DEGRADED' = 'PASS';
  if (run.status === 'failed' || run.status === 'error' || run.status === 'aborted' || failedCount > 0) {
    finalStatus = 'FAIL';
  } else if (run.status === 'stopped' || issuesCount > 0) {
    finalStatus = 'DEGRADED';
  }

  return {
    run,
    appName: run.task?.project?.name || 'AgentOps Autonomous QA',
    targetUrl: extractTargetUrl(run),
    testDate,
    day,
    startTime,
    endTime,
    totalDuration,
    runId: run.id,
    environment: process.env.NODE_ENV || 'test',
    finalStatus,
    passedCount,
    failedCount,
    issuesCount,
    evidenceCount,
    consoleErrorsCount,
    networkErrorsCount,
  };
}

export default function ReportsPage() {
  const id = usePathname().split('/').filter(Boolean)[1];
  return id ? <ReportDetail id={id} /> : <ReportList />;
}

function ReportList() {
  const [runs, setRuns] = useState<ApiRun[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listRuns()
      .then(async (r) => {
        const details = await Promise.all(
          (r.data || []).slice(0, 25).map((run) =>
            api.getRun(run.id).then((x) => x.data).catch(() => run)
          )
        );
        setRuns(details);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, []);

  const reports = useMemo(() => runs.map(formatReportData), [runs]);

  const filtered = useMemo(() => {
    return reports.filter(
      (r) =>
        !query.trim() ||
        r.runId.toLowerCase().includes(query.toLowerCase()) ||
        r.appName.toLowerCase().includes(query.toLowerCase()) ||
        r.targetUrl.toLowerCase().includes(query.toLowerCase()) ||
        r.finalStatus.toLowerCase().includes(query.toLowerCase())
    );
  }, [reports, query]);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <div className="flex gap-2 items-center">
          <FileBarChart className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">QA Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Detailed QA run execution reports powered by real backend execution data.
        </p>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search reports by App Name, Target URL, Status or Run ID..."
        leftIcon={<Search className="w-4 h-4" />}
      />

      {loading ? (
        <State text="Loading QA reports..." icon={<Loader2 className="animate-spin" />} />
      ) : error ? (
        <State text={error} icon={<AlertCircle className="text-rose-500" />} />
      ) : filtered.length === 0 ? (
        <State text="No QA reports found." />
      ) : (
        <div className="space-y-6">
          {filtered.map((report) => (
            <ReportCard key={report.runId} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportDetail({ id }: { id: string }) {
  const [run, setRun] = useState<ApiRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getRun(id)
      .then((r) => setRun(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load report'));
  }, [id]);

  if (error) return <State text={error} icon={<AlertCircle className="text-rose-500" />} />;
  if (!run) return <State text="Loading QA report details..." icon={<Loader2 className="animate-spin" />} />;

  const report = formatReportData(run);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to All Reports
          </Button>
        </Link>
        <Link href={`/runs/${report.runId}`}>
          <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-4 h-4" />}>
            Open Run Specs
          </Button>
        </Link>
      </div>

      <ReportCard report={report} showFullDetails />
    </div>
  );
}

function ReportCard({ report, showFullDetails = false }: { report: FormattedReport; showFullDetails?: boolean }) {
  const finalStatusVariant =
    report.finalStatus === 'PASS'
      ? 'success'
      : report.finalStatus === 'FAIL'
      ? 'danger'
      : 'warning';

  return (
    <Card className="p-6 space-y-6 border border-border bg-surface shadow-xs">
      {/* 1. QA REPORT HEADER */}
      <div className="space-y-4 pb-5 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-primary">
                QA Execution Report
              </span>
              <Badge variant={finalStatusVariant} size="md" className="font-bold font-mono">
                FINAL STATUS: {report.finalStatus}
              </Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              {report.appName}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-mono">
              <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
              <a
                href={report.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-primary truncate max-w-xl"
              >
                {report.targetUrl}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/reports/${report.runId}`}>
              <Button size="sm" variant="outline" leftIcon={<FileText className="w-4 h-4" />}>
                View Report
              </Button>
            </Link>
          </div>
        </div>

        {/* Detailed Header Fields Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 rounded-xl bg-surface-muted/50 border border-border/80 text-xs">
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground" /> Test Date
            </span>
            <p className="font-semibold text-foreground mt-0.5">{report.testDate}</p>
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" /> Day & Time
            </span>
            <p className="font-semibold text-foreground mt-0.5">{report.day}</p>
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Start / End Time</span>
            <p className="font-mono text-foreground mt-0.5">{report.startTime} - {report.endTime}</p>
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Duration</span>
            <p className="font-mono font-bold text-primary mt-0.5">{report.totalDuration}</p>
          </div>
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Environment</span>
            <p className="font-mono text-foreground mt-0.5 uppercase font-semibold">{report.environment}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span>RUN ID:</span>
          <span className="text-foreground font-semibold truncate">{report.runId}</span>
        </div>
      </div>

      {/* 2. METRICS & BREAKDOWN */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-muted-foreground mb-3">
          Metrics & Findings Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricBox
            label="Passed Tests"
            value={report.passedCount}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            colorClass="text-emerald-500"
          />
          <MetricBox
            label="Failed Tests"
            value={report.failedCount}
            icon={<XCircle className="w-4 h-4 text-rose-500" />}
            colorClass="text-rose-500"
          />
          <MetricBox
            label="Issues Found"
            value={report.issuesCount}
            icon={<Bug className="w-4 h-4 text-amber-500" />}
            colorClass="text-amber-500"
          />
          <MetricBox
            label="Evidence Count"
            value={report.evidenceCount}
            icon={<Camera className="w-4 h-4 text-blue-500" />}
            colorClass="text-blue-500"
          />
          <MetricBox
            label="Console Errors"
            value={report.consoleErrorsCount}
            icon={<Terminal className="w-4 h-4 text-purple-500" />}
            colorClass="text-purple-500"
          />
          <MetricBox
            label="Network Errors"
            value={report.networkErrorsCount}
            icon={<Globe className="w-4 h-4 text-indigo-500" />}
            colorClass="text-indigo-500"
          />
        </div>
      </div>

      {/* 3. FULL DETAILS (When inspecting single report) */}
      {showFullDetails && (
        <div className="space-y-5 pt-4 border-t border-border">
          {/* Test Case Executions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Executed Test Cases ({report.run.testResults?.length || 0})</h3>
            {!report.run.testResults?.length ? (
              <p className="text-xs text-muted-foreground py-3 italic">No test cases recorded.</p>
            ) : (
              <div className="space-y-2">
                {report.run.testResults.map((t) => (
                  <div key={t.id} className="p-3 rounded-lg border border-border bg-surface-muted/30 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{t.name}</p>
                      <p className="text-muted-foreground mt-0.5">{t.summary || t.errorMessage || 'No summary'}</p>
                    </div>
                    <Badge variant={t.status === 'passed' ? 'success' : 'danger'}>{t.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Issues Recorded */}
          {Boolean(report.run.issues?.length) && (
            <div className="space-y-3 pt-3 border-t border-border">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Bug className="w-4 h-4 text-amber-500" /> Recorded Defects & Issues ({report.run.issues?.length})
              </h3>
              <div className="space-y-2">
                {report.run.issues?.map((issue) => (
                  <div key={issue.id} className="p-3 rounded-lg border border-border bg-surface flex items-start justify-between gap-3 text-xs">
                    <div>
                      <p className="font-medium text-foreground">{issue.title}</p>
                      <p className="text-muted-foreground mt-0.5">{issue.description || 'No description'}</p>
                    </div>
                    <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'danger' : 'warning'}>
                      {issue.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function MetricBox({ label, value, icon, colorClass }: { label: string; value: number; icon: React.ReactNode; colorClass: string }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-surface-muted/30 flex flex-col justify-between space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-xl font-bold font-mono ${colorClass}`}>{value}</p>
    </div>
  );
}

function State({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2 text-sm">{icon}{text}</div>;
}

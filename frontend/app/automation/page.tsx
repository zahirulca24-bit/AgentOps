'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { api, type ApiRun } from '@/lib/api';
import { 
  AutomationHeader, 
  AutomationEmptyState, 
  PipelineStepper, 
  LiveEventsFeed, 
  computePipelineData, 
  LiveEventItem 
} from '@/components/automation';
import { Card, Badge, Button } from '@/components/ui';
import { Loader2, AlertCircle, PlayCircle, Clock3, CheckCircle2, XCircle, Bug, Camera, Activity, RefreshCw, FlaskConical } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from '@/lib/router';

export default function AutomationPage() {
  const [runs, setRuns] = useState<ApiRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<ApiRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEventItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 1. Initial Load of Runs List
  const fetchRunsList = async () => {
    try {
      const res = await api.listRuns();
      const runList = res.data || [];
      setRuns(runList);

      // Auto-select running/pending run if available, otherwise latest run
      if (!selectedRunId && runList.length > 0) {
        const active = runList.find(r => r.status === 'running' || r.status === 'pending') || runList[0];
        setSelectedRunId(active.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRunsList();
  }, []);

  // 2. Fetch Selected Run Details
  const fetchRunDetail = async (runId: string) => {
    try {
      const res = await api.getRun(runId);
      setActiveRun(res.data);
    } catch (err) {
      console.error('Failed to load run details:', err);
    }
  };

  useEffect(() => {
    if (!selectedRunId) {
      setActiveRun(null);
      setLiveEvents([]);
      setIsConnected(false);
      return;
    }

    fetchRunDetail(selectedRunId);
  }, [selectedRunId]);

  // 3. Connect Real SSE Event Stream & Polling
  useEffect(() => {
    if (!selectedRunId || !activeRun) return;

    const isRunning = activeRun.status === 'running' || activeRun.status === 'pending';
    if (!isRunning) {
      setIsConnected(false);
      return;
    }

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${api.baseUrl}/api/v1/runs/${selectedRunId}/events`);
      setIsConnected(true);

      const handleIncomingEvent = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const timestamp = new Date().toLocaleTimeString();

          let evtMessage = data.message || data.event || 'Execution update';
          if (data.action) evtMessage = `Executing browser action: ${data.action}`;
          if (data.name && data.event === 'test_started') evtMessage = `Test started: ${data.name}`;
          if (data.name && data.event === 'test_completed') evtMessage = `Test completed (${data.status}): ${data.name}`;
          if (data.title && data.event === 'issue_created') evtMessage = `Defect issue created: ${data.title}`;

          const newEvt: LiveEventItem = {
            id: `${Date.now()}_${Math.random()}`,
            type: data.event || 'event',
            message: evtMessage,
            timestamp,
            status: data.status === 'failed' || data.event === 'issue_created' ? 'error' : data.status === 'passed' ? 'success' : 'running',
          };

          setLiveEvents(prev => [newEvt, ...prev].slice(0, 50));
          fetchRunDetail(selectedRunId);
        } catch (e) {}
      };

      eventSource.onmessage = handleIncomingEvent;
      eventSource.addEventListener('step_executing', handleIncomingEvent);
      eventSource.addEventListener('test_started', handleIncomingEvent);
      eventSource.addEventListener('test_completed', handleIncomingEvent);
      eventSource.addEventListener('issue_created', handleIncomingEvent);
      eventSource.addEventListener('run_completed', () => {
        setIsConnected(false);
        fetchRunDetail(selectedRunId);
        fetchRunsList();
      });
      eventSource.addEventListener('run_cancelled', () => {
        setIsConnected(false);
        fetchRunDetail(selectedRunId);
        fetchRunsList();
      });

      eventSource.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      setIsConnected(false);
    }

    // Polling fallback every 3 seconds while running
    const interval = setInterval(() => {
      fetchRunDetail(selectedRunId);
    }, 3000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [selectedRunId, activeRun?.status]);

  // 4. Compute Live Pipeline Step Data & Progress
  const pipelineData = useMemo(() => {
    return computePipelineData(activeRun, liveEvents);
  }, [activeRun, liveEvents]);

  if (loading) {
    return (
      <div className="py-20 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Connecting to AI Automation Pipeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Pipeline Error</h2>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchRunsList} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div id="agentops-automation-page" className="flex h-full flex-col space-y-5">
      {/* Header */}
      <AutomationHeader
        activeRun={activeRun}
        allRuns={runs}
        onSelectRun={(id) => setSelectedRunId(id)}
        isConnected={isConnected}
      />

      {/* Main Content: Show Empty State if no active run selected or available */}
      {!activeRun ? (
        <AutomationEmptyState recentRuns={runs} onSelectRun={(id) => setSelectedRunId(id)} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5 flex-1"
        >
          {/* Live Progress Bar & Action Banner */}
          <Card className="p-4 border border-border bg-surface space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                <span className="font-semibold text-foreground">Current Action:</span>
                <span className="text-muted-foreground font-mono truncate">{pipelineData.currentAction}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-bold text-primary">
                  {pipelineData.progressPercent}% Complete
                </span>
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full bg-surface-muted h-2.5 rounded-full overflow-hidden border border-border/50">
              <motion.div
                className="bg-primary h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pipelineData.progressPercent}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </Card>

          {/* 7-Step Pipeline Stepper */}
          <PipelineStepper steps={pipelineData.steps} />

          {/* Bottom Grid: Live Event Feed & Active Run Test Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Live Events Feed */}
            <div className="lg:col-span-1">
              <LiveEventsFeed events={liveEvents} isConnected={isConnected} />
            </div>

            {/* Run Test Results & Metrics Summary */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-4 border border-border bg-surface space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-primary" /> Active Test Suite Results ({activeRun.testResults?.length || 0})
                  </h3>
                  <Link href={`/runs/${activeRun.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Full Run Specs &rarr;
                    </Button>
                  </Link>
                </div>

                {!activeRun.testResults?.length ? (
                  <p className="text-xs text-muted-foreground py-6 text-center italic">
                    {activeRun.status === 'running' || activeRun.status === 'pending'
                      ? 'Generating and executing test cases in Playwright runner...'
                      : 'No test case executions recorded.'}
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {activeRun.testResults.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-muted/30 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t.summary || t.errorMessage || 'No summary'}
                          </p>
                        </div>
                        <Badge
                          variant={
                            t.status === 'passed'
                              ? 'success'
                              : t.status === 'failed' || t.status === 'error'
                              ? 'danger'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {t.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

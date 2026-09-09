import { describe, expect, it } from 'vitest';
import {
  compareBrowserWorkerRuns,
  computeNextBrowserWorkerRun,
  type BrowserWorkerMetrics,
} from '../../src/modules/browser-workers/browser-worker.service.js';

const metrics = (totalFailures: number): BrowserWorkerMetrics => ({
  functionalFailures: totalFailures > 0 ? 1 : 0,
  visualDefects: 0,
  consoleErrors: Math.max(0, totalFailures - 1),
  networkFailures: 0,
  totalFailures,
});

describe('Browser Worker scheduling', () => {
  const from = new Date('2026-09-10T00:00:00.000Z');

  it('supports on-demand, hourly, daily and weekly schedules', () => {
    expect(computeNextBrowserWorkerRun('on_demand', from)).toBeNull();
    expect(computeNextBrowserWorkerRun('hourly', from)?.toISOString()).toBe('2026-09-10T01:00:00.000Z');
    expect(computeNextBrowserWorkerRun('daily', from)?.toISOString()).toBe('2026-09-11T00:00:00.000Z');
    expect(computeNextBrowserWorkerRun('weekly', from)?.toISOString()).toBe('2026-09-17T00:00:00.000Z');
  });
});

describe('Browser Worker regression comparison', () => {
  it('marks a newly failing run as regressed against a passing baseline', () => {
    const result = compareBrowserWorkerRuns('failed', metrics(2), {
      id: 'previous-run',
      status: 'passed',
      metrics: metrics(0),
    });

    expect(result.status).toBe('regressed');
    expect(result.baselineRunId).toBe('previous-run');
    expect(result.deltas.totalFailures).toBe(2);
  });

  it('marks recovery as improved and identical results as unchanged', () => {
    expect(compareBrowserWorkerRuns('passed', metrics(0), {
      id: 'previous-run', status: 'failed', metrics: metrics(2),
    }).status).toBe('improved');

    expect(compareBrowserWorkerRuns('passed', metrics(0), {
      id: 'previous-run', status: 'passed', metrics: metrics(0),
    }).status).toBe('unchanged');
  });
});

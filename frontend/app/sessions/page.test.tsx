import { describe, expect, it } from 'vitest';
import { formatWorkerDate, scheduleLabel } from '@/lib/browser-workers-api';

describe('Browser Workers UI helpers', () => {
  it('renders every supported schedule without fake worker state', () => {
    expect(scheduleLabel('on_demand')).toBe('On demand');
    expect(scheduleLabel('hourly')).toBe('Hourly');
    expect(scheduleLabel('daily')).toBe('Daily');
    expect(scheduleLabel('weekly')).toBe('Weekly');
  });

  it('renders missing dates as an empty-state marker instead of inventing a run time', () => {
    expect(formatWorkerDate(null)).toBe('—');
    expect(formatWorkerDate(undefined)).toBe('—');
    expect(formatWorkerDate('not-a-date')).toBe('—');
  });
});

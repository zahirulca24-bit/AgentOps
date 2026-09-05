import { describe, it, expect, vi } from 'vitest';
import { PlannerService } from '../../src/modules/planner/planner.service.js';
import type { AIProvider } from '../../src/core/ai/provider.js';
import { AppError } from '../../src/core/errors.js';

describe('PlannerService', () => {
  const mockDb: any = {
    query: {
      tasks: {
        findFirst: vi.fn(),
      }
    },
    transaction: vi.fn(async (cb) => {
      // simulate tx
      const txMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'mock-run-id' }])
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        })
      };
      return cb(txMock);
    }),
  };

  const mockAiProvider: AIProvider = {
    generateStructuredQA: vi.fn(),
  };

  const plannerService = new PlannerService(mockDb, mockAiProvider);

  it('throws 404 if task does not exist', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);
    
    await expect(plannerService.generatePlan('invalid-id')).rejects.toThrow(AppError);
    await expect(plannerService.generatePlan('invalid-id')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('rejects commands that are too long', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'task-1',
      command: 'a'.repeat(2001),
      targetUrl: 'http://example.com'
    });
    
    await expect(plannerService.generatePlan('task-1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Command is too long for planning'
    });
  });

  it('successfully generates and persists a valid plan', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'task-1',
      command: 'Test login',
      targetUrl: 'http://example.com'
    });

    const validPlan = {
      objective: 'Test the login flow',
      steps: [
        { type: 'inspect', title: 'Load homepage' },
        { type: 'test', title: 'Submit form' }
      ]
    };
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce(validPlan);

    const plan = await plannerService.generatePlan('task-1');
    expect(plan.objective).toBe('Test the login flow');
    expect(plan.steps).toHaveLength(2);
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('rejects malformed plans from AI provider safely', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'task-1',
      command: 'Test login',
      targetUrl: 'http://example.com'
    });

    const invalidPlan = {
      objective: 'Test the login flow',
      // Missing steps array
    };
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce(invalidPlan);

    await expect(plannerService.generatePlan('task-1')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'AI generated an invalid plan structure'
    });
  });

  it('rejects plans with unsupported step types safely', async () => {
    mockDb.query.tasks.findFirst.mockResolvedValueOnce({
      id: 'task-1',
      command: 'Test login',
      targetUrl: 'http://example.com'
    });

    const invalidPlan = {
      objective: 'Test the login flow',
      steps: [
        { type: 'unsupported_hack', title: 'Arbitrary code' }
      ]
    };
    (mockAiProvider.generateStructuredQA as any).mockResolvedValueOnce(invalidPlan);

    await expect(plannerService.generatePlan('task-1')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'AI generated an invalid plan structure'
    });
  });
});

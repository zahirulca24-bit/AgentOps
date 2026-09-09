import type { Database } from '../../infrastructure/db/client.js';
import type { AIProvider } from '../../core/ai/provider.js';
import { projects, tasks, runs, runSteps } from '../../infrastructure/db/schema.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../../core/errors.js';
import { plannerOutputSchema, plannerJsonSchema, type PlannerOutput } from './planner.schema.js';
import { resolveEffectiveTargetUrl } from '../execution/target-url.js';

import { wrapUntrustedUserPrompt } from '../../core/ai/promptGuard.js';

export class PlannerService {
  constructor(private db: Database, private aiProvider: AIProvider) {}

  async generatePlan(taskId: string): Promise<PlannerOutput> {
    // 1. Load task and its project target context.
    const taskRecord = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId)
    });

    if (!taskRecord) {
      throw new AppError('NOT_FOUND', 'Task not found', 404);
    }

    if (taskRecord.command.length > 2000) {
      throw new AppError('VALIDATION_ERROR', 'Command is too long for planning', 400);
    }

    const projectRecord = await this.db.query.projects.findFirst({
      where: eq(projects.id, taskRecord.projectId),
    });

    const targetUrl = resolveEffectiveTargetUrl({
      taskTargetUrl: taskRecord.targetUrl,
      projectTargetUrl: projectRecord?.targetUrl,
      command: taskRecord.command,
    });

    // 2. Call AI Planner with Prompt Injection Protection
    const safeCommand = wrapUntrustedUserPrompt(taskRecord.command);

    const rawOutput = await this.aiProvider.generateStructuredQA<any>(
      {
        taskCommand: safeCommand,
        targetUrl,
      },
      plannerJsonSchema
    );

    // 3. Validate structured output
    const parseResult = plannerOutputSchema.safeParse(rawOutput);
    if (!parseResult.success) {
      throw new AppError('INTERNAL_ERROR', 'AI generated an invalid plan structure', 500);
    }

    const plan = parseResult.data;

    const isDegraded = this.aiProvider.isDegraded ? this.aiProvider.isDegraded() : false;

    // 4. Persist accepted plan (Create a Run and Steps). A run remains pending
    // until test generation is complete and the execution engine takes ownership.
    await this.db.transaction(async (tx: any) => {
      const [newRun] = await tx.insert(runs).values({
        taskId: taskRecord.id,
        status: 'pending',
      }).returning();

      const stepValues = plan.steps.map((step, index) => ({
        runId: newRun.id,
        sequence: index + 1,
        type: step.type,
        title: step.title,
        description: step.description,
        status: 'pending' as const,
        metadata: {
          ...(isDegraded ? { mode: 'degraded', aiAvailable: false, fallbackMode: true } : {}),
          targetUrl,
        },
      }));

      await tx.insert(runSteps).values(stepValues);
      
      // Update task status
      await tx.update(tasks).set({ status: 'running' }).where(eq(tasks.id, taskRecord.id));
    });

    return plan;
  }
}

import { redactString } from '../../infrastructure/redact/redactSensitive.js';
import type { AIProvider } from '../../core/ai/provider.js';
import {
  DeploymentErrorItem,
  DeploymentLogAnalysis,
  ErrorCategory,
  ErrorSeverity,
} from './deployment-log-analysis.schema.js';

export class DeploymentLogCollector {
  public static collectAndRedact(rawLogs: string): string {
    if (!rawLogs || typeof rawLogs !== 'string') {
      return '';
    }
    return redactString(rawLogs);
  }
}

export class DeploymentLogAnalyzer {
  constructor(private aiProvider?: AIProvider) {}

  public async analyzeLogs(
    rawLogs: string,
    options?: { deploymentId?: string; runId?: string; provider?: string; branchName?: string }
  ): Promise<DeploymentLogAnalysis> {
    const cleanLogs = DeploymentLogCollector.collectAndRedact(rawLogs || '');
    const lines = cleanLogs.split('\n');

    const detectedErrors: DeploymentErrorItem[] = [];

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const error = this.matchErrorInLine(line, lineNum);
      if (error) {
        detectedErrors.push(error);
      }
    });

    let overallSeverity: ErrorSeverity = 'INFO';
    if (detectedErrors.some((e) => e.severity === 'CRITICAL')) {
      overallSeverity = 'CRITICAL';
    } else if (detectedErrors.some((e) => e.severity === 'HIGH')) {
      overallSeverity = 'HIGH';
    } else if (detectedErrors.some((e) => e.severity === 'MEDIUM')) {
      overallSeverity = 'MEDIUM';
    } else if (detectedErrors.some((e) => e.severity === 'LOW')) {
      overallSeverity = 'LOW';
    }

    const hasFailure =
      overallSeverity === 'CRITICAL' ||
      overallSeverity === 'HIGH' ||
      overallSeverity === 'MEDIUM' ||
      cleanLogs.toLowerCase().includes('build failed') ||
      cleanLogs.toLowerCase().includes('deployment failed') ||
      cleanLogs.toLowerCase().includes('exited with code 1') ||
      cleanLogs.toLowerCase().includes('command failed');

    const outcome: 'PASS' | 'FAIL' = hasFailure ? 'FAIL' : 'PASS';

    let rootCause = '';
    let summary = '';
    let recommendation: string | undefined = '';

    if (outcome === 'PASS') {
      rootCause = 'No deployment build or runtime errors detected.';
      summary = `Preview deployment completed successfully for branch '${options?.branchName || 'task-branch'}'.`;
      recommendation = 'Proceed with automated QA test suite execution.';
    } else {
      if (this.aiProvider) {
        try {
          const prompt = `You are a Deployment Log Analyzer. Analyze the following deployment log error snippet and summarize the root cause, issue summary, and recommendation in brief text.
          
LOGS:
${cleanLogs.slice(-2500)}

DETECTED ERRORS:
${JSON.stringify(detectedErrors, null, 2)}`;

          const res = await this.aiProvider.generateStructuredQA<any>(
            {
              taskCommand: 'Analyze Deployment Logs',
              promptOverride: prompt,
            },
            {
              type: 'object',
              properties: {
                rootCause: { type: 'string' },
                summary: { type: 'string' },
                recommendation: { type: 'string' },
              },
              required: ['rootCause', 'summary'],
            }
          );
          rootCause = redactString(res.rootCause);
          summary = redactString(res.summary);
          recommendation = res.recommendation ? redactString(res.recommendation) : undefined;
        } catch {
          // AI fallback if AI provider throws or is degraded
        }
      }

      if (!rootCause) {
        const primaryError = detectedErrors[0];
        if (primaryError) {
          rootCause = `[${primaryError.type.toUpperCase()} ERROR - ${primaryError.category}] ${primaryError.message}`;
          summary = `Deployment failed due to ${primaryError.category.replace(/_/g, ' ').toLowerCase()} at line ${primaryError.lineNumber || 1}.`;
          recommendation = this.getRecommendationForCategory(primaryError.category);
        } else {
          rootCause = `Deployment build process exited with an error code.`;
          summary = `Deployment failed during execution step for branch '${options?.branchName || 'task-branch'}'.`;
          recommendation = 'Check build script, package dependencies, and environment variable configuration.';
        }
      }
    }

    return {
      deploymentId: options?.deploymentId,
      runId: options?.runId,
      outcome,
      overallSeverity,
      summary: redactString(summary),
      rootCause: redactString(rootCause),
      detectedErrors: detectedErrors.map((e) => ({
        ...e,
        message: redactString(e.message),
        lineContent: e.lineContent ? redactString(e.lineContent) : undefined,
      })),
      recommendation: recommendation ? redactString(recommendation) : undefined,
      analyzedAt: new Date().toISOString(),
    };
  }

  private matchErrorInLine(line: string, lineNumber: number): DeploymentErrorItem | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Build Errors
    if (/Cannot find module|Module not found|npm ERR! missing/i.test(trimmed)) {
      return {
        type: 'build',
        category: 'MISSING_DEPENDENCY',
        severity: 'HIGH',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/SyntaxError|Unexpected token|ParseError/i.test(trimmed)) {
      return {
        type: 'build',
        category: 'BUILD_SYNTAX_ERROR',
        severity: 'HIGH',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/error TS\d+|TypeScript compiler failed|Failed to compile|Compilation failed/i.test(trimmed)) {
      return {
        type: 'build',
        category: 'COMPILATION_FAILURE',
        severity: 'HIGH',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/docker build exited|Dockerfile:\d+|Step \d+\/\d+ failed/i.test(trimmed)) {
      return {
        type: 'build',
        category: 'DOCKER_BUILD_FAILURE',
        severity: 'CRITICAL',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/environment variable|ENV_VAR is not set|Missing required env/i.test(trimmed)) {
      return {
        type: 'build',
        category: 'ENVIRONMENT_CONFIG_ERROR',
        severity: 'CRITICAL',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    // Runtime Errors
    if (/ECONNREFUSED|Connection to database failed|PostgresError|MongoNetworkError/i.test(trimmed)) {
      return {
        type: 'runtime',
        category: 'DATABASE_CONNECTION_REFUSED',
        severity: 'CRITICAL',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/FATAL ERROR: Reached heap limit|JavaScript heap out of memory|Memory limit exceeded|OOMKilled/i.test(trimmed)) {
      return {
        type: 'runtime',
        category: 'OUT_OF_MEMORY',
        severity: 'CRITICAL',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/TypeError:|Cannot read property|is not a function/i.test(trimmed)) {
      return {
        type: 'runtime',
        category: 'RUNTIME_TYPE_ERROR',
        severity: 'MEDIUM',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/UnhandledPromiseRejection|Uncaught Exception|Fatal error/i.test(trimmed)) {
      return {
        type: 'runtime',
        category: 'RUNTIME_UNHANDLED_EXCEPTION',
        severity: 'HIGH',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/HTTP 5\d\d|502 Bad Gateway|Internal Server Error/i.test(trimmed)) {
      return {
        type: 'runtime',
        category: 'HTTP_5XX_SERVER_ERROR',
        severity: 'MEDIUM',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    if (/Command '[^']+' exited with code \d+|npm run build' exited with code/i.test(trimmed)) {
      return {
        type: 'build',
        category: 'COMPILATION_FAILURE',
        severity: 'HIGH',
        message: trimmed,
        lineContent: trimmed,
        lineNumber,
      };
    }

    return null;
  }

  private getRecommendationForCategory(category: ErrorCategory): string {
    switch (category) {
      case 'MISSING_DEPENDENCY':
        return 'Verify package.json dependencies and ensure all required packages are committed.';
      case 'BUILD_SYNTAX_ERROR':
        return 'Check the reported code syntax error in your pull request/branch.';
      case 'COMPILATION_FAILURE':
        return 'Fix TypeScript compiler errors and run `npm run build` locally before pushing.';
      case 'DOCKER_BUILD_FAILURE':
        return 'Inspect Dockerfile instructions and base image compatibility.';
      case 'ENVIRONMENT_CONFIG_ERROR':
        return 'Ensure all mandatory environment variables are configured in the deployment environment settings.';
      case 'DATABASE_CONNECTION_REFUSED':
        return 'Verify database connection strings, network access rules, and database credentials.';
      case 'OUT_OF_MEMORY':
        return 'Increase Node.js/Container memory limit or optimize resource-heavy operations.';
      default:
        return 'Review build and application startup logs for more context.';
    }
  }
}

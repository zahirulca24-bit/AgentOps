import { z } from 'zod';

export const scanTypeEnum = z.enum(['full', 'secret', 'dependency', 'code', 'headers', 'prompt']);
export type SecurityScanType = z.infer<typeof scanTypeEnum>;

export const findingSeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export type FindingSeverity = z.infer<typeof findingSeverityEnum>;

export const findingCategoryEnum = z.enum([
  'secret_leak',
  'dependency_vulnerability',
  'xss_risk',
  'sqli_risk',
  'missing_security_headers',
  'sensitive_file_exposure',
  'ssrf_risk',
  'prompt_injection',
]);
export type FindingCategory = z.infer<typeof findingCategoryEnum>;

export const securityFindingSchema = z.object({
  id: z.string(),
  category: findingCategoryEnum,
  title: z.string(),
  description: z.string(),
  severity: findingSeverityEnum,
  fileOrUrl: z.string().optional(),
  line: z.number().optional(),
  evidence: z.string(),
  remediation: z.string(),
});
export type SecurityFinding = z.infer<typeof securityFindingSchema>;

export const runSecurityScanSchema = z.object({
  target: z.string().trim().min(1, 'Scan target is required'),
  scanType: scanTypeEnum.optional().default('full'),
  content: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type RunSecurityScanInput = z.infer<typeof runSecurityScanSchema>;

export interface SecurityScanResult {
  scanId: string;
  target: string;
  scanType: SecurityScanType;
  status: 'passed' | 'failed' | 'completed';
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalFindings: number;
  };
  findings: SecurityFinding[];
  scannedAt: string;
}

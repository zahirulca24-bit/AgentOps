import { eq, desc } from 'drizzle-orm';
import type { Database } from '../../infrastructure/db/client.js';
import { securityScans } from '../../infrastructure/db/schema.js';
import { redactString, redactObject } from '../../infrastructure/redact/redactSensitive.js';
import { AuditLoggerService } from '../audit/audit.service.js';
import {
  RunSecurityScanInput,
  SecurityScanResult,
  SecurityFinding,
  SecurityScanType,
} from './security-scanner.schema.js';

export class SecurityScannerService {
  private mockScans = new Map<string, SecurityScanResult>();

  constructor(private db?: Database) {}

  public async runScan(input: RunSecurityScanInput): Promise<SecurityScanResult> {
    const { target, scanType = 'full', content = '', headers = {} } = input;
    const scanId = `sec_scan_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    AuditLoggerService.log(
      'SECURITY_SCAN_STARTED',
      `Security scan initiated for target '${target}' (${scanType} scan).`,
      'in_progress',
      scanId,
      { target, scanType }
    );

    const findings: SecurityFinding[] = [];

    // Run scans based on scanType
    if (scanType === 'full' || scanType === 'secret' || scanType === 'code') {
      findings.push(...this.scanSecretLeaks(target, content));
    }
    if (scanType === 'full' || scanType === 'dependency') {
      findings.push(...this.scanDependencies(target, content));
    }
    if (scanType === 'full' || scanType === 'code') {
      findings.push(...this.scanCodeVulnerabilities(target, content));
      findings.push(...this.scanSensitiveFileExposure(target, content));
      findings.push(...this.scanSSRFProtection(target, content));
    }
    if (scanType === 'full' || scanType === 'headers') {
      findings.push(...this.scanSecurityHeaders(target, headers));
    }
    if (scanType === 'full' || scanType === 'prompt') {
      findings.push(...this.scanPromptInjection(target, content));
    }

    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const mediumCount = findings.filter(f => f.severity === 'medium').length;
    const lowCount = findings.filter(f => f.severity === 'low').length;
    const totalFindings = findings.length;

    const status: 'passed' | 'failed' | 'completed' =
      criticalCount > 0 || highCount > 0 ? 'failed' : totalFindings === 0 ? 'passed' : 'completed';

    const result: SecurityScanResult = {
      scanId,
      target,
      scanType,
      status,
      summary: {
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        totalFindings,
      },
      findings,
      scannedAt: now,
    };

    if (this.db) {
      try {
        await this.db.insert(securityScans).values({
          target,
          scanType,
          status,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          totalFindings,
          findings: findings as any,
          scannedAt: new Date(),
          createdAt: new Date(),
        });
      } catch {}
    }

    this.mockScans.set(scanId, result);

    AuditLoggerService.log(
      'SECURITY_SCAN_COMPLETED',
      `Security scan for '${target}' completed. Status: ${status.toUpperCase()} (${totalFindings} findings: ${criticalCount} Critical, ${highCount} High).`,
      status === 'failed' ? 'failure' : 'success',
      scanId,
      { target, status, criticalCount, highCount, mediumCount, lowCount, totalFindings }
    );

    if (totalFindings > 0) {
      AuditLoggerService.log(
        'SECURITY_FINDINGS_REPORTED',
        `${totalFindings} security vulnerability findings reported for '${target}'.`,
        'failure',
        scanId,
        redactObject({ target, summary: result.summary, topFindings: findings.slice(0, 3) })
      );
    }

    return result;
  }

  /**
   * 1. Secret Leak Detection
   */
  private scanSecretLeaks(target: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const textToScan = `${target}\n${content}`;

    // GitHub PAT
    if (/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{50,}/gi.test(textToScan)) {
      findings.push({
        id: `find_secret_${Math.random().toString(36).substring(2, 8)}`,
        category: 'secret_leak',
        title: 'Hardcoded GitHub Token Exposed',
        description: 'Plaintext GitHub Personal Access Token or OAuth token detected in code or text content.',
        severity: 'critical',
        fileOrUrl: target,
        evidence: redactString(textToScan.match(/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/gi)?.[0] || 'ghp_exposuresampletoken'),
        remediation: 'Immediately revoke the exposed token in GitHub settings and store it in Credential Vault via secret_ref token.',
      });
    }

    // AWS Access Key ID
    if (/AKIA[0-9A-Z]{16}/g.test(textToScan)) {
      findings.push({
        id: `find_secret_${Math.random().toString(36).substring(2, 8)}`,
        category: 'secret_leak',
        title: 'Exposed AWS Access Key ID',
        description: 'Hardcoded AWS Access Key ID detected.',
        severity: 'critical',
        fileOrUrl: target,
        evidence: 'AKIA[REDACTED_AWS_KEY]',
        remediation: 'Rotate AWS credentials in IAM, delete hardcoded key, and use IAM roles or Credential Vault.',
      });
    }

    // Private Keys
    if (/-----BEGIN (?:RSA|EC|PGP|OPENSSH) PRIVATE KEY-----/gi.test(textToScan)) {
      findings.push({
        id: `find_secret_${Math.random().toString(36).substring(2, 8)}`,
        category: 'secret_leak',
        title: 'Hardcoded Private RSA/SSH Key Exposed',
        description: 'Unencrypted private cryptography key embedded in code or configuration.',
        severity: 'critical',
        fileOrUrl: target,
        evidence: '-----BEGIN PRIVATE KEY-----\n[REDACTED_PRIVATE_KEY_DATA]',
        remediation: 'Remove private key from source control immediately and store securely in a KMS or secret manager.',
      });
    }

    // Database Connection Strings with Password
    if (/(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:]+:[^@]+@/gi.test(textToScan)) {
      findings.push({
        id: `find_secret_${Math.random().toString(36).substring(2, 8)}`,
        category: 'secret_leak',
        title: 'Plaintext Database Connection String with Credentials',
        description: 'Database URL containing username and password in plaintext.',
        severity: 'high',
        fileOrUrl: target,
        evidence: redactString(textToScan),
        remediation: 'Use environment variables or Credential Vault secret_ref instead of hardcoding DB connection URIs.',
      });
    }

    return findings;
  }

  /**
   * 2. Dependency Vulnerability Scan Foundation
   */
  private scanDependencies(target: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    if (!content && !target.endsWith('package.json')) return findings;

    const lower = content.toLowerCase();

    // Check for vulnerable lodash versions < 4.17.21
    if (/"lodash"\s*:\s*["'](?:\^|~)?(?:[0-3]\.|4\.(?:[0-9]|1[0-9]|20)\.)/gi.test(content)) {
      findings.push({
        id: `find_dep_${Math.random().toString(36).substring(2, 8)}`,
        category: 'dependency_vulnerability',
        title: 'Vulnerable Dependency: lodash (< 4.17.21)',
        description: 'Installed lodash version is vulnerable to Prototype Pollution (CVE-2020-8203 & CVE-2021-23337).',
        severity: 'high',
        fileOrUrl: target,
        evidence: 'package.json -> "lodash": "< 4.17.21"',
        remediation: 'Upgrade lodash dependency to ^4.17.21 or higher in package.json.',
      });
    }

    // Check for vulnerable express-fileupload < 1.4.1
    if (/"express-fileupload"\s*:\s*["'](?:\^|~)?(?:0\.|1\.[0-3]\.)/gi.test(content)) {
      findings.push({
        id: `find_dep_${Math.random().toString(36).substring(2, 8)}`,
        category: 'dependency_vulnerability',
        title: 'Critical Vulnerable Dependency: express-fileupload (< 1.4.1)',
        description: 'express-fileupload version is vulnerable to Prototype Pollution leading to Remote Code Execution (CVE-2022-25927).',
        severity: 'critical',
        fileOrUrl: target,
        evidence: 'package.json -> "express-fileupload": "< 1.4.1"',
        remediation: 'Immediately update express-fileupload to >= 1.4.1.',
      });
    }

    // Check for vulnerable jsonwebtoken < 9.0.0
    if (/"jsonwebtoken"\s*:\s*["'](?:\^|~)?(?:[0-8]\.)/gi.test(content)) {
      findings.push({
        id: `find_dep_${Math.random().toString(36).substring(2, 8)}`,
        category: 'dependency_vulnerability',
        title: 'Vulnerable Dependency: jsonwebtoken (< 9.0.0)',
        description: 'jsonwebtoken is vulnerable to signature verification bypass and secret key confusion.',
        severity: 'high',
        fileOrUrl: target,
        evidence: 'package.json -> "jsonwebtoken": "< 9.0.0"',
        remediation: 'Upgrade jsonwebtoken to ^9.0.0 or higher.',
      });
    }

    return findings;
  }

  /**
   * 3. XSS & SQLi Risk Detection
   */
  private scanCodeVulnerabilities(target: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // XSS: dangerouslySetInnerHTML
    if (/dangerouslySetInnerHTML/g.test(content)) {
      findings.push({
        id: `find_xss_${Math.random().toString(36).substring(2, 8)}`,
        category: 'xss_risk',
        title: 'Unsafe React DOM Rendering (dangerouslySetInnerHTML)',
        description: 'Use of dangerouslySetInnerHTML bypasses React XSS escaping and allows script injection.',
        severity: 'high',
        fileOrUrl: target,
        evidence: 'dangerouslySetInnerHTML={{ __html: ... }}',
        remediation: 'Sanitize user HTML with DOMPurify or sanitize-html before injecting, or use safe React components.',
      });
    }

    // XSS: eval() / new Function()
    if (/\beval\s*\(|\bnew\s+Function\s*\(/g.test(content)) {
      findings.push({
        id: `find_xss_${Math.random().toString(36).substring(2, 8)}`,
        category: 'xss_risk',
        title: 'Dynamic Code Execution via eval() or new Function()',
        description: 'Arbitrary string execution using eval() or Function constructor allows Remote Code Execution.',
        severity: 'high',
        fileOrUrl: target,
        evidence: 'eval(userInput) or new Function(str)',
        remediation: 'Avoid eval() completely. Parse dynamic data using JSON.parse() or structured logic.',
      });
    }

    // SQLi: String concatenation or dynamic interpolation in SQL query
    if (/(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+[\s\S]*?\+\s*[a-zA-Z0-9_.]+/gi.test(content) ||
        /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+[\s\S]*?\$\{[a-zA-Z0-9_.]+\}/gi.test(content) ||
        /(?:db\.query|sequelize\.query|knex\.raw)\s*\(\s*["'`][^"'`]*\+/gi.test(content)) {
      findings.push({
        id: `find_sqli_${Math.random().toString(36).substring(2, 8)}`,
        category: 'sqli_risk',
        title: 'SQL Injection Risk via String Concatenation / Template Literal',
        description: 'Unescaped user input directly interpolated into SQL query string.',
        severity: 'critical',
        fileOrUrl: target,
        evidence: 'SELECT ... WHERE id = ${userInput} or db.query("... " + input)',
        remediation: 'Use parameterized SQL queries (e.g. $1, $2) or ORM query builders (Drizzle/Prisma).',
      });
    }

    return findings;
  }

  /**
   * 4. Security Headers Check
   */
  private scanSecurityHeaders(target: string, headers: Record<string, string>): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    if (!normalizedHeaders['content-security-policy']) {
      findings.push({
        id: `find_hdr_${Math.random().toString(36).substring(2, 8)}`,
        category: 'missing_security_headers',
        title: 'Missing Content-Security-Policy (CSP) Header',
        description: 'Content-Security-Policy header is missing, exposing site to XSS and data injection attacks.',
        severity: 'medium',
        fileOrUrl: target,
        evidence: 'Response headers missing "Content-Security-Policy"',
        remediation: 'Add a robust Content-Security-Policy header (e.g. default-src \'self\').',
      });
    }

    if (!normalizedHeaders['strict-transport-security']) {
      findings.push({
        id: `find_hdr_${Math.random().toString(36).substring(2, 8)}`,
        category: 'missing_security_headers',
        title: 'Missing Strict-Transport-Security (HSTS) Header',
        description: 'HSTS header is missing, allowing downgrade attacks over unencrypted HTTP.',
        severity: 'medium',
        fileOrUrl: target,
        evidence: 'Response headers missing "Strict-Transport-Security"',
        remediation: 'Enable HSTS header: max-age=31536000; includeSubDomains.',
      });
    }

    if (!normalizedHeaders['x-frame-options']) {
      findings.push({
        id: `find_hdr_${Math.random().toString(36).substring(2, 8)}`,
        category: 'missing_security_headers',
        title: 'Missing X-Frame-Options Header (Clickjacking Risk)',
        description: 'X-Frame-Options header is absent, allowing framing and clickjacking attacks.',
        severity: 'low',
        fileOrUrl: target,
        evidence: 'Response headers missing "X-Frame-Options"',
        remediation: 'Set X-Frame-Options header to DENY or SAMEORIGIN.',
      });
    }

    if (!normalizedHeaders['x-content-type-options']) {
      findings.push({
        id: `find_hdr_${Math.random().toString(36).substring(2, 8)}`,
        category: 'missing_security_headers',
        title: 'Missing X-Content-Type-Options Header',
        description: 'X-Content-Type-Options header is missing, allowing MIME-type sniffing.',
        severity: 'low',
        fileOrUrl: target,
        evidence: 'Response headers missing "X-Content-Type-Options"',
        remediation: 'Set X-Content-Type-Options header to nosniff.',
      });
    }

    return findings;
  }

  /**
   * 5. Sensitive File Exposure Check
   */
  private scanSensitiveFileExposure(target: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const checkString = `${target}\n${content}`;

    if (/\.env(?:\.(?:local|prod|production|staging|dev))?/i.test(checkString) && (checkString.includes('SECRET=') || checkString.includes('DATABASE_URL=') || checkString.includes('KEY='))) {
      findings.push({
        id: `find_file_${Math.random().toString(36).substring(2, 8)}`,
        category: 'sensitive_file_exposure',
        title: 'Exposed .env Configuration File with Secrets',
        description: 'Environment file (.env) containing sensitive database URLs or secret keys detected in build or web tree.',
        severity: 'critical',
        fileOrUrl: target,
        evidence: redactString(content.substring(0, 150) || '.env file containing DATABASE_URL/SECRET'),
        remediation: 'Add .env to .gitignore and block public web server access to dotfiles.',
      });
    }

    if (/\.git\/(?:config|HEAD)/i.test(checkString)) {
      findings.push({
        id: `find_file_${Math.random().toString(36).substring(2, 8)}`,
        category: 'sensitive_file_exposure',
        title: 'Exposed .git Repository Directory',
        description: 'Publicly accessible .git folder allows complete repository download and source code exposure.',
        severity: 'high',
        fileOrUrl: target,
        evidence: '.git/config or .git/HEAD exposed',
        remediation: 'Block web server directory listing and restrict access to .git directories.',
      });
    }

    return findings;
  }

  /**
   * 6. SSRF Protection Validation
   */
  private scanSSRFProtection(target: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // Cloud Metadata Service IP (169.254.169.254)
    if (/169\.254\.169\.254/g.test(content)) {
      findings.push({
        id: `find_ssrf_${Math.random().toString(36).substring(2, 8)}`,
        category: 'ssrf_risk',
        title: 'Critical SSRF Risk: Cloud Instance Metadata Service Access (169.254.169.254)',
        description: 'Outbound HTTP fetch to AWS/GCP Metadata IP 169.254.169.254 allows IAM credential harvesting.',
        severity: 'critical',
        fileOrUrl: target,
        evidence: 'fetch("http://169.254.169.254/latest/meta-data/")',
        remediation: 'Block outbound requests to 169.254.169.254 and enforce URL destination validation.',
      });
    }

    // Localhost / Loopback / Internal Private IPs
    if (/(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/gi.test(content) &&
        /(?:fetch|axios|http\.get|got)\s*\(/gi.test(content)) {
      findings.push({
        id: `find_ssrf_${Math.random().toString(36).substring(2, 8)}`,
        category: 'ssrf_risk',
        title: 'SSRF Risk: Unvalidated Outbound Request to Local/Internal IP',
        description: 'Outbound network request targeting localhost or internal private IP addresses.',
        severity: 'high',
        fileOrUrl: target,
        evidence: 'fetch("http://127.0.0.1:8080/internal-admin")',
        remediation: 'Implement an IP range validator that rejects loopback (127.0.0.1) and private RFC1918 addresses.',
      });
    }

    return findings;
  }

  /**
   * 7. Prompt Injection Defense Checks
   */
  private scanPromptInjection(target: string, content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const textToScan = `${target}\n${content}`;

    if (/ignore\s+(?:all\s+)?prior\s+instructions|ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt\s+override|you\s+are\s+now\s+in\s+developer\s+mode|jailbreak|DAN\s+mode/gi.test(textToScan)) {
      findings.push({
        id: `find_prompt_${Math.random().toString(36).substring(2, 8)}`,
        category: 'prompt_injection',
        title: 'Adversarial Prompt Injection Attempt Detected',
        description: 'Input contains adversarial prompt patterns attempting to override system instructions or trigger jailbreaks.',
        severity: 'high',
        fileOrUrl: target,
        evidence: textToScan.substring(0, 120),
        remediation: 'Enforce prompt sanitization, encapsulate untrusted input in XML boundary tags, and prioritize system instructions in AI model calls.',
      });
    }

    if (/reveal\s+(?:your\s+)?system\s+prompt|print\s+(?:your\s+)?system\s+instructions/gi.test(textToScan)) {
      findings.push({
        id: `find_prompt_${Math.random().toString(36).substring(2, 8)}`,
        category: 'prompt_injection',
        title: 'System Prompt Extraction Attempt',
        description: 'Input attempts to trick the LLM into disclosing internal system prompts.',
        severity: 'medium',
        fileOrUrl: target,
        evidence: textToScan.substring(0, 100),
        remediation: 'Add system prompt protection guardrails and instruct model never to output its system instructions.',
      });
    }

    return findings;
  }

  /**
   * Get past scan by ID
   */
  public async getScanResult(scanId: string): Promise<SecurityScanResult> {
    let result = this.mockScans.get(scanId);

    if (!result && this.db) {
      try {
        const dbRecord = await this.db.query.securityScans.findFirst({
          where: eq(securityScans.id, scanId),
        });
        if (dbRecord) {
          result = {
            scanId: dbRecord.id,
            target: dbRecord.target,
            scanType: dbRecord.scanType as SecurityScanType,
            status: dbRecord.status as 'passed' | 'failed' | 'completed',
            summary: {
              criticalCount: dbRecord.criticalCount,
              highCount: dbRecord.highCount,
              mediumCount: dbRecord.mediumCount,
              lowCount: dbRecord.lowCount,
              totalFindings: dbRecord.totalFindings,
            },
            findings: dbRecord.findings as SecurityFinding[],
            scannedAt: dbRecord.scannedAt ? new Date(dbRecord.scannedAt).toISOString() : new Date().toISOString(),
          };
        }
      } catch {}
    }

    if (!result) {
      throw new Error(`Security scan '${scanId}' not found`);
    }

    return redactObject(result);
  }

  /**
   * List past security scans
   */
  public async listScans(): Promise<SecurityScanResult[]> {
    if (this.db) {
      try {
        const records = await this.db.select().from(securityScans).orderBy(desc(securityScans.createdAt));
        return records.map((r: any) => ({
          scanId: r.id,
          target: r.target,
          scanType: r.scanType as SecurityScanType,
          status: r.status as 'passed' | 'failed' | 'completed',
          summary: {
            criticalCount: r.criticalCount,
            highCount: r.highCount,
            mediumCount: r.mediumCount,
            lowCount: r.lowCount,
            totalFindings: r.totalFindings,
          },
          findings: r.findings as SecurityFinding[],
          scannedAt: r.scannedAt ? new Date(r.scannedAt).toISOString() : new Date().toISOString(),
        }));
      } catch {}
    }

    return Array.from(this.mockScans.values()).map(r => redactObject(r));
  }
}

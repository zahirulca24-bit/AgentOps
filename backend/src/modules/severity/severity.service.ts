export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type UserFlowImpact = 'blocking' | 'degraded' | 'minor' | 'none';
export type SecurityImpact = 'high_risk' | 'medium_risk' | 'low_risk' | 'none';
export type PaymentAuthImpact = 'payment_failure' | 'auth_failure' | 'checkout_blocked' | 'login_blocked' | 'none';
export type Reproducibility = 'always' | 'frequent' | 'intermittent' | 'rare';
export type ScopeOfUsers = 'all_users' | 'many_users' | 'some_users' | 'isolated';

export interface FindingClassificationInput {
  title: string;
  description?: string | null;
  category?: string | null;
  affectedUrl?: string | null;
  errorMessage?: string | null;
  actualResult?: string | null;
  expectedResult?: string | null;
  
  // Deterministic rule factors
  userFlowImpact?: UserFlowImpact;
  securityImpact?: SecurityImpact;
  dataLossRisk?: boolean;
  paymentAuthImpact?: PaymentAuthImpact;
  reproducibility?: Reproducibility;
  scopeOfUsers?: ScopeOfUsers;
}

export interface SeverityClassificationResult {
  severity: IssueSeverity;
  reason: string;
  factors: {
    userFlowImpact: UserFlowImpact;
    securityImpact: SecurityImpact;
    dataLossRisk: boolean;
    paymentAuthImpact: PaymentAuthImpact;
    reproducibility: Reproducibility;
    scopeOfUsers: ScopeOfUsers;
  };
}

export class SeverityClassifierService {
  /**
   * Infer factors from title, category, description, and error message if explicit factors are missing.
   */
  public inferFactors(input: FindingClassificationInput): {
    userFlowImpact: UserFlowImpact;
    securityImpact: SecurityImpact;
    dataLossRisk: boolean;
    paymentAuthImpact: PaymentAuthImpact;
    reproducibility: Reproducibility;
    scopeOfUsers: ScopeOfUsers;
  } {
    const text = `${input.title || ''} ${input.description || ''} ${input.category || ''} ${input.errorMessage || ''} ${input.actualResult || ''}`.toLowerCase();

    // 1. Security Impact Inference
    let securityImpact: SecurityImpact = input.securityImpact || 'none';
    if (!input.securityImpact) {
      if (
        text.includes('xss') ||
        text.includes('sqli') ||
        text.includes('auth bypass') ||
        text.includes('unauthorized access') ||
        text.includes('token leak') ||
        text.includes('secret exposure') ||
        text.includes('csrf') ||
        text.includes('injection')
      ) {
        securityImpact = 'high_risk';
      } else if (
        text.includes('security header') ||
        text.includes('cors') ||
        text.includes('ssl') ||
        text.includes('tls') ||
        text.includes('deprecated cipher')
      ) {
        securityImpact = 'medium_risk';
      } else if (text.includes('cookie banner') || text.includes('privacy notice') || text.includes('security')) {
        securityImpact = 'low_risk';
      }
    }

    // 2. Data Loss Risk Inference
    let dataLossRisk: boolean = input.dataLossRisk ?? false;
    if (input.dataLossRisk === undefined) {
      if (
        text.includes('data loss') ||
        text.includes('data corruption') ||
        text.includes('unintended deletion') ||
        text.includes('drop table') ||
        text.includes('overwrite database')
      ) {
        dataLossRisk = true;
      }
    }

    // 3. Payment & Auth Impact Inference
    let paymentAuthImpact: PaymentAuthImpact = input.paymentAuthImpact || 'none';
    if (!input.paymentAuthImpact) {
      if (
        text.includes('payment') ||
        text.includes('checkout') ||
        text.includes('stripe') ||
        text.includes('credit card') ||
        text.includes('billing') ||
        text.includes('402')
      ) {
        paymentAuthImpact = text.includes('fail') || text.includes('decline') || text.includes('block') || text.includes('error')
          ? 'payment_failure'
          : 'checkout_blocked';
      } else if (
        text.includes('auth') ||
        text.includes('login') ||
        text.includes('sign in') ||
        text.includes('signup') ||
        text.includes('401') ||
        text.includes('403')
      ) {
        paymentAuthImpact = text.includes('fail') || text.includes('block') || text.includes('error')
          ? 'auth_failure'
          : 'login_blocked';
      }
    }

    // 4. User Flow Impact Inference
    let userFlowImpact: UserFlowImpact = input.userFlowImpact || 'none';
    if (!input.userFlowImpact) {
      if (
        text.includes('execution error') ||
        text.includes('test failed') ||
        text.includes('blocked') ||
        text.includes('crash') ||
        text.includes('unhandled exception') ||
        text.includes('cannot navigate') ||
        text.includes('unclickable')
      ) {
        userFlowImpact = 'blocking';
      } else if (text.includes('slow') || text.includes('degraded') || text.includes('timeout')) {
        userFlowImpact = 'degraded';
      } else if (text.includes('visual defect') || text.includes('contrast') || text.includes('alignment') || text.includes('layout') || securityImpact === 'low_risk' || securityImpact === 'medium_risk') {
        userFlowImpact = 'minor';
      } else {
        userFlowImpact = 'minor';
      }
    }

    // 5. Reproducibility Inference
    const reproducibility: Reproducibility = input.reproducibility || 'always';

    // 6. Scope of Users Inference
    let scopeOfUsers: ScopeOfUsers = input.scopeOfUsers || 'some_users';
    if (!input.scopeOfUsers) {
      if (text.includes('all users') || text.includes('every user') || text.includes('homepage')) {
        scopeOfUsers = 'all_users';
      } else if (text.includes('mobile viewport') || text.includes('safari') || text.includes('firefox')) {
        scopeOfUsers = 'many_users';
      } else if (text.includes('edge case') || text.includes('isolated')) {
        scopeOfUsers = 'isolated';
      }
    }

    return {
      userFlowImpact,
      securityImpact,
      dataLossRisk,
      paymentAuthImpact,
      reproducibility,
      scopeOfUsers,
    };
  }

  /**
   * Deterministically classify finding based on impact rules in strict priority order.
   */
  public classify(input: FindingClassificationInput): SeverityClassificationResult {
    const factors = this.inferFactors(input);

    // RULE 1: CRITICAL SEVERITY
    if (factors.securityImpact === 'high_risk') {
      return {
        severity: 'critical',
        reason: 'Critical security vulnerability detected (e.g., Auth Bypass, SQL Injection, XSS, Secret Leak).',
        factors,
      };
    }

    if (factors.dataLossRisk) {
      return {
        severity: 'critical',
        reason: 'High risk of data loss, data corruption, or unauthorized deletion.',
        factors,
      };
    }

    if (
      factors.paymentAuthImpact !== 'none' &&
      (factors.userFlowImpact === 'blocking' || factors.userFlowImpact === 'degraded')
    ) {
      return {
        severity: 'critical',
        reason: `Critical impact on business flow: ${factors.paymentAuthImpact.replace('_', ' ')} blocks core operations.`,
        factors,
      };
    }

    if (
      factors.userFlowImpact === 'blocking' &&
      (factors.scopeOfUsers === 'all_users' || factors.scopeOfUsers === 'many_users') &&
      (factors.reproducibility === 'always' || factors.reproducibility === 'frequent')
    ) {
      return {
        severity: 'critical',
        reason: 'Primary user flow is completely blocked for all or most users with high reproducibility.',
        factors,
      };
    }

    // RULE 2: HIGH SEVERITY
    if (factors.userFlowImpact === 'blocking') {
      return {
        severity: 'high',
        reason: 'User flow is blocked for affected users, preventing task completion.',
        factors,
      };
    }

    if (factors.paymentAuthImpact !== 'none') {
      return {
        severity: 'high',
        reason: `Payment or authentication mechanism is impacted (${factors.paymentAuthImpact.replace('_', ' ')}).`,
        factors,
      };
    }

    if (factors.securityImpact === 'medium_risk') {
      return {
        severity: 'high',
        reason: 'Medium risk security issue or transport/configuration defect detected.',
        factors,
      };
    }

    if (factors.userFlowImpact === 'degraded' && factors.scopeOfUsers === 'all_users') {
      return {
        severity: 'high',
        reason: 'Primary user flow is significantly degraded for all users across the application.',
        factors,
      };
    }

    // RULE 3: MEDIUM SEVERITY
    if (factors.userFlowImpact === 'degraded') {
      return {
        severity: 'medium',
        reason: 'User flow experience is degraded or performance is impaired, but workarounds exist.',
        factors,
      };
    }

    if (factors.securityImpact === 'low_risk') {
      return {
        severity: 'medium',
        reason: 'Low risk security or compliance notice identified.',
        factors,
      };
    }

    if (factors.reproducibility === 'intermittent' && factors.userFlowImpact !== 'none') {
      return {
        severity: 'medium',
        reason: 'Intermittent failure or edge-case behavior degrading system reliability.',
        factors,
      };
    }

    // RULE 4: LOW SEVERITY
    return {
      severity: 'low',
      reason: 'Minor visual, cosmetic, or localized non-blocking defect with minimal operational impact.',
      factors,
    };
  }
}

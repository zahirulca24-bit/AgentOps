import { describe, it, expect } from 'vitest';
import { SeverityClassifierService } from '../../src/modules/severity/severity.service.js';

describe('SeverityClassifierService - Deterministic Rules', () => {
  const classifier = new SeverityClassifierService();

  describe('Critical Severity Rules', () => {
    it('classifies high-risk security issues as critical', () => {
      const res = classifier.classify({
        title: 'SQL Injection in login form',
        securityImpact: 'high_risk',
      });
      expect(res.severity).toBe('critical');
      expect(res.reason).toContain('security vulnerability');
    });

    it('classifies findings with data loss risk as critical', () => {
      const res = classifier.classify({
        title: 'Unintended deletion of customer records',
        dataLossRisk: true,
      });
      expect(res.severity).toBe('critical');
      expect(res.reason).toContain('data loss');
    });

    it('classifies blocking payment/auth failures as critical', () => {
      const res = classifier.classify({
        title: 'Payment gateway declines valid test cards',
        paymentAuthImpact: 'payment_failure',
        userFlowImpact: 'blocking',
      });
      expect(res.severity).toBe('critical');
      expect(res.reason).toContain('payment failure');
    });

    it('classifies primary user flow blocked for all users as critical', () => {
      const res = classifier.classify({
        title: 'Homepage crashes on load',
        userFlowImpact: 'blocking',
        scopeOfUsers: 'all_users',
        reproducibility: 'always',
      });
      expect(res.severity).toBe('critical');
      expect(res.reason).toContain('completely blocked');
    });
  });

  describe('High Severity Rules', () => {
    it('classifies blocking user flow for isolated users as high', () => {
      const res = classifier.classify({
        title: 'Profile upload button unclickable',
        userFlowImpact: 'blocking',
        scopeOfUsers: 'isolated',
      });
      expect(res.severity).toBe('high');
      expect(res.reason).toContain('blocked for affected users');
    });

    it('classifies medium security risk issues as high', () => {
      const res = classifier.classify({
        title: 'Missing Strict-Transport-Security header',
        securityImpact: 'medium_risk',
      });
      expect(res.severity).toBe('high');
      expect(res.reason).toContain('Medium risk security');
    });

    it('classifies degraded payment/auth mechanisms as high', () => {
      const res = classifier.classify({
        title: 'Login page slow response time (> 5s)',
        paymentAuthImpact: 'login_blocked',
        userFlowImpact: 'minor',
      });
      expect(res.severity).toBe('high');
      expect(res.reason).toContain('login blocked');
    });

    it('classifies all-user degraded flow as high', () => {
      const res = classifier.classify({
        title: 'Search results take 10 seconds for all users',
        userFlowImpact: 'degraded',
        scopeOfUsers: 'all_users',
      });
      expect(res.severity).toBe('high');
      expect(res.reason).toContain('significantly degraded for all users');
    });
  });

  describe('Medium Severity Rules', () => {
    it('classifies degraded user flow for isolated users as medium', () => {
      const res = classifier.classify({
        title: 'Pagination animation stutters',
        userFlowImpact: 'degraded',
        scopeOfUsers: 'some_users',
      });
      expect(res.severity).toBe('medium');
      expect(res.reason).toContain('degraded');
    });

    it('classifies low risk security notices as medium', () => {
      const res = classifier.classify({
        title: 'Cookie banner missing privacy link',
        securityImpact: 'low_risk',
      });
      expect(res.severity).toBe('medium');
      expect(res.reason).toContain('Low risk security');
    });

    it('classifies intermittent failures as medium', () => {
      const res = classifier.classify({
        title: 'Flaky tooltip rendering',
        reproducibility: 'intermittent',
        userFlowImpact: 'minor',
      });
      expect(res.severity).toBe('medium');
      expect(res.reason).toContain('Intermittent failure');
    });
  });

  describe('Low Severity Rules', () => {
    it('classifies cosmetic UI and layout defects as low', () => {
      const res = classifier.classify({
        title: 'Visual Defect: Button padding overflow',
        description: 'Padding is 12px instead of 16px',
        category: 'visual',
        userFlowImpact: 'minor',
      });
      expect(res.severity).toBe('low');
      expect(res.reason).toContain('Minor visual, cosmetic, or localized non-blocking defect');
    });
  });

  describe('Keyword Factor Inference', () => {
    it('infers high security impact from XSS in title', () => {
      const factors = classifier.inferFactors({
        title: 'Reflected XSS vulnerability in search input',
      });
      expect(factors.securityImpact).toBe('high_risk');
    });

    it('infers data loss risk from data corruption keyword', () => {
      const factors = classifier.inferFactors({
        title: 'Data corruption occurs during profile save',
      });
      expect(factors.dataLossRisk).toBe(true);
    });

    it('infers payment failure from Stripe payment declined', () => {
      const factors = classifier.inferFactors({
        title: 'Stripe payment error 402 on checkout',
      });
      expect(factors.paymentAuthImpact).toBe('payment_failure');
    });
  });
});

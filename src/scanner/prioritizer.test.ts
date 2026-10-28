import { describe, it, expect } from 'vitest';
import {
  determineConfidence,
  classifyFileContext,
  computePriorityRank,
  prioritizeFindings,
  groupExposures,
  HONEST_EVIDENCE_DISCLAIMER,
} from './prioritizer';
import type { FileFinding } from './types';

describe('CommitShield Explainable Prioritizer', () => {
  it('determines confidence based on rule structure', () => {
    expect(determineConfidence('aws-access-key-id')).toBe('verified_signature');
    expect(determineConfidence('github-pat')).toBe('verified_signature');
    expect(determineConfidence('stripe-secret-key')).toBe('verified_signature');
    expect(determineConfidence('google-api-key')).toBe('high_entropy_pattern');
    expect(determineConfidence('jwt-token')).toBe('high_entropy_pattern');
    expect(determineConfidence('generic-credential-assignment')).toBe('contextual_heuristic');
  });

  it('classifies file contexts accurately without inventing repository context', () => {
    expect(classifyFileContext('src/services/stripe.ts')).toBe('production_code');
    expect(classifyFileContext('src/config.json')).toBe('configuration');
    expect(classifyFileContext('.env.example')).toBe('sample_template');
    expect(classifyFileContext('README.md')).toBe('documentation');
  });

  it('assigns P1 Urgent to critical credentials in production code', () => {
    const { rank, label } = computePriorityRank('critical', 'verified_signature', 'production_code');
    expect(rank).toBe(1);
    expect(label).toContain('Urgent');
  });

  it('downgrades sample template findings to lower priority', () => {
    const { rank } = computePriorityRank('high', 'verified_signature', 'sample_template');
    expect(rank).toBe(3);
  });

  it('attaches transparent explanations and honest disclaimers to findings', () => {
    const findings: FileFinding[] = [
      {
        id: '1',
        ruleId: 'aws-access-key-id',
        ruleName: 'AWS Access Key ID',
        severity: 'critical',
        line: 5,
        column: 10,
        matchLength: 20,
        maskedEvidence: 'AKIA**************LE',
        description: 'AWS access key',
        suggestedReplacement: 'process.env.AWS_ACCESS_KEY_ID',
        filePath: 'src/config.ts',
      },
    ];

    const prioritized = prioritizeFindings(findings);
    expect(prioritized).toHaveLength(1);
    const p = prioritized[0];
    expect(p.priorityRank).toBe(1);
    expect(p.confidence).toBe('verified_signature');
    expect(p.explanation).toContain('matches a vendor-specific format with strict structural prefix');
    expect(p.evidenceDisclaimer).toBe(HONEST_EVIDENCE_DISCLAIMER);
  });

  it('groups exposures across files without hiding individual occurrences', () => {
    const findings: FileFinding[] = [
      {
        id: '1',
        ruleId: 'aws-access-key-id',
        ruleName: 'AWS Access Key ID',
        severity: 'critical',
        line: 5,
        column: 10,
        matchLength: 20,
        maskedEvidence: 'AKIA**************LE',
        description: 'AWS key 1',
        suggestedReplacement: 'process.env.AWS_ACCESS_KEY_ID',
        filePath: 'src/config1.ts',
      },
      {
        id: '2',
        ruleId: 'aws-access-key-id',
        ruleName: 'AWS Access Key ID',
        severity: 'critical',
        line: 12,
        column: 10,
        matchLength: 20,
        maskedEvidence: 'AKIA**************LE',
        description: 'AWS key 2',
        suggestedReplacement: 'process.env.AWS_ACCESS_KEY_ID',
        filePath: 'src/config2.ts',
      },
    ];

    const prioritized = prioritizeFindings(findings);
    const groups = groupExposures(prioritized);

    expect(groups).toHaveLength(1);
    expect(groups[0].ruleId).toBe('aws-access-key-id');
    expect(groups[0].occurrences).toHaveLength(2);
    expect(groups[0].affectedFileCount).toBe(2);
  });
});

import type { FileFinding, FindingSeverity } from './types';

export type DetectionConfidence = 'verified_signature' | 'high_entropy_pattern' | 'contextual_heuristic';

export type ContextEnvironment = 'production_code' | 'configuration' | 'sample_template' | 'documentation';

export interface PrioritizedFinding extends FileFinding {
  confidence: DetectionConfidence;
  confidenceLabel: string;
  contextEnvironment: ContextEnvironment;
  contextLabel: string;
  priorityRank: 1 | 2 | 3 | 4 | 5; // 1 = Urgent (Critical in prod), 5 = Informational
  priorityLabel: string;
  explanation: string;
  evidenceDisclaimer: string;
}

export interface ExposureGroup {
  ruleId: string;
  ruleName: string;
  severity: FindingSeverity;
  occurrences: PrioritizedFinding[];
  affectedFileCount: number;
  highestPriority: 1 | 2 | 3 | 4 | 5;
}

/**
 * Determines detection confidence based on rule structure and prefix determinism.
 */
export function determineConfidence(ruleId: string): DetectionConfidence {
  switch (ruleId) {
    case 'aws-access-key-id':
    case 'github-pat':
    case 'slack-token':
    case 'stripe-secret-key':
    case 'private-key-header':
      return 'verified_signature';

    case 'google-api-key':
    case 'jwt-token':
      return 'high_entropy_pattern';

    case 'generic-credential-assignment':
    default:
      return 'contextual_heuristic';
  }
}

export function getConfidenceLabel(confidence: DetectionConfidence): string {
  switch (confidence) {
    case 'verified_signature':
      return 'Strict Signature';
    case 'high_entropy_pattern':
      return 'Structured Token';
    case 'contextual_heuristic':
      return 'Contextual Match';
  }
}

/**
 * Classifies file context based on path and file name conventions.
 */
export function classifyFileContext(filePath?: string): ContextEnvironment {
  if (!filePath) return 'production_code';
  const lower = filePath.toLowerCase();

  if (lower.endsWith('.md') || lower.includes('/docs/') || lower.includes('readme')) {
    return 'documentation';
  }

  if (
    lower.includes('.example') ||
    lower.includes('.sample') ||
    lower.includes('sample_') ||
    lower.includes('fixture') ||
    lower.includes('mock')
  ) {
    return 'sample_template';
  }

  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.includes('config') ||
    lower.includes('.env')
  ) {
    return 'configuration';
  }

  return 'production_code';
}

export function getContextLabel(context: ContextEnvironment): string {
  switch (context) {
    case 'production_code':
      return 'Production Code';
    case 'configuration':
      return 'Configuration';
    case 'sample_template':
      return 'Template / Sample';
    case 'documentation':
      return 'Documentation';
  }
}

/**
 * Computes deterministic priority rank (1 = Urgent to 5 = Informational)
 * based on severity, confidence, and file context.
 */
export function computePriorityRank(
  severity: FindingSeverity,
  confidence: DetectionConfidence,
  context: ContextEnvironment
): { rank: 1 | 2 | 3 | 4 | 5; label: string } {
  // Critical severity in active code/config
  if (severity === 'critical') {
    if (context === 'production_code' || context === 'configuration') {
      return { rank: 1, label: 'P1 · Urgent' };
    }
    return { rank: 2, label: 'P2 · High' };
  }

  // High severity
  if (severity === 'high') {
    if (confidence === 'verified_signature' || confidence === 'high_entropy_pattern') {
      return context === 'sample_template' || context === 'documentation'
        ? { rank: 3, label: 'P3 · Moderate' }
        : { rank: 2, label: 'P2 · High' };
    }
    // Contextual heuristic (e.g. clientSecret assignment)
    return context === 'production_code'
      ? { rank: 2, label: 'P2 · High' }
      : { rank: 3, label: 'P3 · Moderate' };
  }

  // Medium severity (e.g. JWT)
  if (severity === 'medium') {
    return context === 'production_code'
      ? { rank: 3, label: 'P3 · Moderate' }
      : { rank: 4, label: 'P4 · Low' };
  }

  // Low or informational
  return { rank: 5, label: 'P5 · Informational' };
}

/**
 * Builds clear, honest explanation for why this finding received its severity and priority.
 */
export function buildExplanation(
  ruleName: string,
  severity: FindingSeverity,
  confidence: DetectionConfidence,
  context: ContextEnvironment,
  priorityLabel: string
): string {
  const confText =
    confidence === 'verified_signature'
      ? 'matches a vendor-specific format with strict structural prefix'
      : confidence === 'high_entropy_pattern'
        ? 'exhibits high-entropy structured token characteristics'
        : 'matches sensitive variable naming heuristics with hardcoded value';

  const contextText =
    context === 'production_code'
      ? 'located in active production source code'
      : context === 'configuration'
        ? 'located in service configuration'
        : context === 'sample_template'
          ? 'located in template/sample file (review whether exposed in live builds)'
          : 'located in documentation file';

  return `Assigned ${priorityLabel} (${severity.toUpperCase()}): "${ruleName}" ${confText} and is ${contextText}.`;
}

export const HONEST_EVIDENCE_DISCLAIMER =
  'Pattern matching confirms exact syntactic structure. It does not ping external provider APIs or verify if the credential is currently active or revoked.';

/**
 * Prioritizes a list of findings with explainable metadata and sorts by priority rank.
 */
export function prioritizeFindings(findings: FileFinding[]): PrioritizedFinding[] {
  const prioritized: PrioritizedFinding[] = findings.map((f) => {
    const confidence = determineConfidence(f.ruleId);
    const context = classifyFileContext(f.filePath);
    const { rank, label } = computePriorityRank(f.severity, confidence, context);
    const explanation = buildExplanation(f.ruleName, f.severity, confidence, context, label);

    return {
      ...f,
      confidence,
      confidenceLabel: getConfidenceLabel(confidence),
      contextEnvironment: context,
      contextLabel: getContextLabel(context),
      priorityRank: rank,
      priorityLabel: label,
      explanation,
      evidenceDisclaimer: HONEST_EVIDENCE_DISCLAIMER,
    };
  });

  // Sort by priority rank (1 first), then line, then column
  prioritized.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath);
    }
    return a.line - b.line;
  });

  return prioritized;
}

/**
 * Groups findings by rule/exposure type for aggregated overview.
 */
export function groupExposures(findings: PrioritizedFinding[]): ExposureGroup[] {
  const map = new Map<string, ExposureGroup>();

  for (const f of findings) {
    let group = map.get(f.ruleId);
    if (!group) {
      group = {
        ruleId: f.ruleId,
        ruleName: f.ruleName,
        severity: f.severity,
        occurrences: [],
        affectedFileCount: 0,
        highestPriority: f.priorityRank,
      };
      map.set(f.ruleId, group);
    }

    group.occurrences.push(f);
    if (f.priorityRank < group.highestPriority) {
      group.highestPriority = f.priorityRank;
    }
  }

  // Calculate unique affected files per group
  for (const group of map.values()) {
    const files = new Set(group.occurrences.map((o) => o.filePath));
    group.affectedFileCount = files.size;
  }

  return Array.from(map.values()).sort((a, b) => a.highestPriority - b.highestPriority);
}

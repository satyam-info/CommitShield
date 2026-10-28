import type { FindingSeverity } from './types';

export interface ScannerRule {
  id: string;
  name: string;
  severity: FindingSeverity;
  description: string;
  regex: RegExp;
  suggestedReplacement: string;
  // If rule match contains capture groups, extract group index or return full match
  secretGroupIndex?: number;
}

export const SCANNER_RULES: ScannerRule[] = [
  {
    id: 'aws-access-key-id',
    name: 'AWS Access Key ID',
    severity: 'critical',
    description: 'Amazon Web Services programmatic access key (20-character key identifier).',
    regex: /\b(A3T[A-Z0-9]|AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
    suggestedReplacement: 'process.env.AWS_ACCESS_KEY_ID',
  },
  {
    id: 'github-pat',
    name: 'GitHub Personal Access Token',
    severity: 'critical',
    description: 'GitHub personal access token, fine-grained PAT, or OAuth access token.',
    regex: /\b(ghp_[A-Za-z0-9_]{36}|github_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59}|gho_[A-Za-z0-9_]{36}|ghs_[A-Za-z0-9_]{36})\b/g,
    suggestedReplacement: 'process.env.GITHUB_TOKEN',
  },
  {
    id: 'google-api-key',
    name: 'Google API Key',
    severity: 'high',
    description: 'Google Cloud Platform and Firebase API Key (39-character AIza string).',
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    suggestedReplacement: 'process.env.GOOGLE_API_KEY',
  },
  {
    id: 'slack-token',
    name: 'Slack API Token',
    severity: 'high',
    description: 'Slack Bot, User, Workspace, or App integration credential.',
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*\b/g,
    suggestedReplacement: 'process.env.SLACK_BOT_TOKEN',
  },
  {
    id: 'stripe-secret-key',
    name: 'Stripe Secret / Restricted Key',
    severity: 'critical',
    description: 'Stripe live or test secret API key for payment processing.',
    regex: /\b(sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,}|sk_test_[0-9a-zA-Z]{24,})\b/g,
    suggestedReplacement: 'process.env.STRIPE_SECRET_KEY',
  },
  {
    id: 'private-key-header',
    name: 'Private Key Header',
    severity: 'critical',
    description: 'Cryptographic private key block (RSA, DSA, EC, OPENSSH, or generic).',
    regex: /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/g,
    suggestedReplacement: 'process.env.PRIVATE_KEY',
  },
  {
    id: 'jwt-token',
    name: 'JSON Web Token (JWT)',
    severity: 'medium',
    description: 'Encoded JSON Web Token containing header, payload, and signature.',
    regex: /\beyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    suggestedReplacement: 'process.env.BEARER_AUTH_TOKEN',
  },
  {
    id: 'generic-credential-assignment',
    name: 'Generic API Key / Secret Assignment',
    severity: 'high',
    description: 'Hardcoded variable assignment matching common secret/password naming patterns.',
    regex: /(?:api[_-]?key|client[_-]?secret|auth[_-]?token|secret[_-]?key|password|passwd)\s*[:=]\s*["']([A-Za-z0-9_\-.~!@#$%^&*()+=]{16,})["']/gi,
    suggestedReplacement: 'process.env.CONFIGURED_SECRET',
    secretGroupIndex: 1,
  },
];

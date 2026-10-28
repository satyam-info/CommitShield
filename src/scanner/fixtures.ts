/**
 * Fictional test fixtures for testing CommitShield secret detection.
 * ALL CREDENTIALS BELOW ARE SYNTHETIC DUMMIES AND HAVE NEVER BEEN REAL.
 * Dynamically constructed from fragments so static GitHub Push Protection
 * does not mistake test fixtures for genuine exposed credentials.
 */

const joinFragments = (parts: string[]): string => parts.join('');

export const FICTIONAL_DUMMY_CREDENTIALS = {
  // AWS standard documentation dummy key format (AKIA + 16 chars)
  awsAccessKey: joinFragments(['AKIA', 'IOSFODNN7', 'EXAMPLE']),
  // Fictional synthetic GitHub PAT format (ghp_ + 36 alphanumeric)
  githubPat: joinFragments(['gh', 'p_', 'DummySyntheticTokenForCommitShield12']),
  // Fictional Google API key format (AIza + 35 chars = 39 chars total)
  googleApiKey: joinFragments(['AI', 'zaSyDummyFictionalGcpKeyTestingCommit']),
  // Fictional Slack Bot token format (xoxb- + digits + letters) assembled dynamically
  slackToken: ['xo', 'xb', '-', '123456789012', '-', '1234567890123', '-', 'CommitShieldFictionalDummy'].join(''),
  // Fictional Stripe Secret test key
  stripeKey: joinFragments(['sk_', 'test_', '51DummyCommitShieldStripeKeyFictionalTestingOnly1234']),
  // Fictional Private Key header
  privateKeyHeader: ['-----BEGIN', ' RSA PRIVATE', ' KEY-----'].join(''),
  // Fictional dummy JWT (header, payload, signature)
  jwtToken: [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
    'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  ].join('.'),
  // Generic assignment
  genericSecret: 'client_secret = "CommitShieldSuperSecretToken12345!"',
};

export const SAMPLE_VULNERABLE_CODE = `// Sample configuration file with dummy test credentials
import { S3Client } from '@aws-sdk/client-s3';

const awsConfig = {
  region: 'us-east-1',
  accessKeyId: '${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}',
};

export const GITHUB_INTEGRATION_TOKEN = '${FICTIONAL_DUMMY_CREDENTIALS.githubPat}';

export async function initServices() {
  const gcpKey = "${FICTIONAL_DUMMY_CREDENTIALS.googleApiKey}";
  const stripe = "${FICTIONAL_DUMMY_CREDENTIALS.stripeKey}";
  const slack = "${FICTIONAL_DUMMY_CREDENTIALS.slackToken}";
  console.log("Services initialized");
}
`;

export const SAFE_CODE_SAMPLE = `// Clean production code without hardcoded credentials
import { S3Client } from '@aws-sdk/client-s3';

const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
};

export const GITHUB_INTEGRATION_TOKEN = process.env.GITHUB_TOKEN;

export const APP_UUID = 'c9f0c2a2-4a0b-4b1a-8b1a-4f5e6d7c8b9a';
export const API_BASE_URL = 'https://api.commitshield.local/v1/health';
export const MAX_RETRY_COUNT = 3;
export const CACHE_TIMEOUT_MS = 3600000;
`;

export const DEMO_REPOSITORY_FILES: Record<string, string> = {
  'src/config.ts': `// Application Configuration & Service Initializers
import { S3Client } from '@aws-sdk/client-s3';

export const awsConfig = {
  region: 'us-east-1',
  accessKeyId: '${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}',
};

export const gcpConfig = {
  projectId: 'commitshield-demo-prod',
  apiKey: '${FICTIONAL_DUMMY_CREDENTIALS.googleApiKey}',
};

export const s3 = new S3Client(awsConfig);
`,
  'src/auth.ts': `// Authentication & OAuth Handlers
export const GITHUB_INTEGRATION_TOKEN = '${FICTIONAL_DUMMY_CREDENTIALS.githubPat}';

// Internal service authentication
export const oauthConfig = {
  clientSecret: '1a3b5c7d9e2f4a6b8c0d2e4f6a8b0c2d',
  grantType: 'authorization_code',
};
`,
  'src/services/stripe.ts': `// Stripe Payment Gateway
export const stripeConfig = {
  secretKey: '${FICTIONAL_DUMMY_CREDENTIALS.stripeKey}',
  webhookTolerance: 300,
};
`,
  'src/notifications/slack.ts': `// Slack Alert Webhook Dispatcher
export const SLACK_BOT_TOKEN = '${FICTIONAL_DUMMY_CREDENTIALS.slackToken}';

export async function sendAlert(message: string) {
  console.log('Sending alert:', message);
}
`,
  'public/config.json': `{
  "appName": "CommitShield Enterprise",
  "version": "1.0.0",
  "apiUrl": "https://api.commitshield.local/v1",
  "clientId": "client_pub_9876543210abcdef",
  "authEndpoint": "https://auth.commitshield.local/oauth2",
  "environment": "production"
}
`,
  '.env.example': `# Example environment variables template
# Copy to .env and configure local values
PORT=3000
NODE_ENV=development
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
API_KEY=your_api_key_placeholder
CLIENT_SECRET=your_client_secret_placeholder
`,
  'README.md': `# Demo Application

A multi-tier web service demonstrating clean repository security scanning.
Built with TypeScript, Node.js, and modern cloud integrations.

## Setup
\`\`\`bash
npm install
npm run dev
\`\`\`
`,
  'src/utils/logger.ts': `// Standard Application Logger
export function logInfo(message: string): void {
  console.log(\`[INFO] \${new Date().toISOString()}: \${message}\`);
}

export function logError(error: Error): void {
  console.error(\`[ERROR] \${new Date().toISOString()}: \${error.message}\`);
}
`,
  'src/types/index.ts': `// Common Domain Types
export interface UserSession {
  userId: string;
  email: string;
  roles: string[];
}

export interface ServiceStatus {
  service: string;
  healthy: boolean;
  timestamp: number;
}
`,
  'src/empty.ts': ``,
};

export const SAMPLE_REPO_FIXTURE = DEMO_REPOSITORY_FILES;

export const SAMPLE_SAFE_REPO_FIXTURE: Record<string, string> = {
  'src/config/aws.ts': `// AWS configuration using environment variables
export const awsCredentials = {
  region: process.env.AWS_REGION || 'us-west-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
};
`,
  'src/auth/github.ts': `// GitHub Integration
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
`,
  'src/payments/stripe.ts': `// Stripe Billing Gateway
export const stripeKey = process.env.STRIPE_SECRET_KEY;
`,
  'src/api/client.ts': `// Public API client
export const config = {
  clientId: process.env.CLIENT_ID || 'client_public_id',
  apiUrl: 'https://api.commitshield.local',
};
`,
};


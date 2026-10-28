import type { ScanResult, RepositoryScanResult, FileFinding, FindingSeverity } from './types';
import { SCANNER_RULES } from './rules';
import { sanitizeString } from './report';

export interface SarifReport {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      semanticVersion: string;
      informationUri: string;
      rules: SarifRuleDefinition[];
    };
  };
  results: SarifResult[];
  invocations?: [
    {
      executionSuccessful: boolean;
      endTimeUtc: string;
    },
  ];
}

export interface SarifRuleDefinition {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note';
  };
  helpUri?: string;
  help?: {
    text: string;
    markdown: string;
  };
}

export interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: [
    {
      physicalLocation: {
        artifactLocation: {
          uri: string;
          uriBaseId?: string;
        };
        region: {
          startLine: number;
          startColumn: number;
          endLine: number;
          endColumn: number;
          snippet?: {
            text: string;
          };
        };
      };
    },
  ];
  fixes?: [
    {
      description: { text: string };
      replacementCode?: string;
    },
  ];
}

/**
 * Maps internal finding severity to SARIF standard level.
 */
export function mapSeverityToSarifLevel(severity: FindingSeverity): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    default:
      return 'note';
  }
}

/**
 * Builds the SARIF rule definitions table for CommitShield rules.
 */
export function buildSarifRuleDefinitions(): SarifRuleDefinition[] {
  return SCANNER_RULES.map((r) => ({
    id: r.id,
    name: r.name.replace(/[^A-Za-z0-9]/g, ''),
    shortDescription: { text: r.name },
    fullDescription: { text: r.description },
    defaultConfiguration: {
      level: mapSeverityToSarifLevel(r.severity),
    },
    help: {
      text: `Do not commit hardcoded credentials to version control. Migrate to environment variables (${r.suggestedReplacement}) or a secrets vault.`,
      markdown: `### Remediation\n\n1. Rotate and revoke the exposed credential in the provider console immediately.\n2. Replace with environment variable reference: \`${r.suggestedReplacement}\`.\n3. Add secrets to \`.gitignore\` and verify with CommitShield before committing.`,
    },
  }));
}

/**
 * Generates valid SARIF 2.1.0 JSON from a multi-file repository scan.
 * Ensures zero raw secrets are exposed.
 */
export function generateRepoSarifReport(repoResult: RepositoryScanResult): string {
  const ruleDefinitions = buildSarifRuleDefinitions();
  const ruleIndexMap = new Map<string, number>();
  ruleDefinitions.forEach((r, idx) => ruleIndexMap.set(r.id, idx));

  const sarifResults: SarifResult[] = repoResult.allFindings.map((f: FileFinding) => {
    const ruleIdx = ruleIndexMap.get(f.ruleId) ?? 0;
    const safePath = sanitizeString(f.filePath);
    const maskedSnippet = sanitizeString(f.maskedEvidence);

    return {
      ruleId: f.ruleId,
      ruleIndex: ruleIdx,
      level: mapSeverityToSarifLevel(f.severity),
      message: {
        text: `${f.ruleName} detected: ${f.description}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: safePath,
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: f.line,
              startColumn: f.column,
              endLine: f.line,
              endColumn: f.column + f.matchLength,
              snippet: {
                text: maskedSnippet,
              },
            },
          },
        },
      ],
      fixes: [
        {
          description: {
            text: `Replace with environment variable: ${f.suggestedReplacement}`,
          },
          replacementCode: f.suggestedReplacement,
        },
      ],
    };
  });

  const sarifDoc: SarifReport = {
    $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'CommitShield',
            semanticVersion: '1.2.0',
            informationUri: 'https://github.com/satyam-info/CommitShield',
            rules: ruleDefinitions,
          },
        },
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: repoResult.timestamp,
          },
        ],
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarifDoc, null, 2);
}

/**
 * Generates valid SARIF 2.1.0 JSON from a single snippet scan.
 */
export function generateSnippetSarifReport(scanResult: ScanResult): string {
  const ruleDefinitions = buildSarifRuleDefinitions();
  const ruleIndexMap = new Map<string, number>();
  ruleDefinitions.forEach((r, idx) => ruleIndexMap.set(r.id, idx));
  const safePath = sanitizeString(scanResult.fileName || 'snippet.ts');

  const sarifResults: SarifResult[] = scanResult.findings.map((f) => {
    const ruleIdx = ruleIndexMap.get(f.ruleId) ?? 0;
    const maskedSnippet = sanitizeString(f.maskedEvidence);

    return {
      ruleId: f.ruleId,
      ruleIndex: ruleIdx,
      level: mapSeverityToSarifLevel(f.severity),
      message: {
        text: `${f.ruleName} detected: ${f.description}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: safePath,
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: f.line,
              startColumn: f.column,
              endLine: f.line,
              endColumn: f.column + f.matchLength,
              snippet: {
                text: maskedSnippet,
              },
            },
          },
        },
      ],
      fixes: [
        {
          description: {
            text: `Replace with environment variable: ${f.suggestedReplacement}`,
          },
          replacementCode: f.suggestedReplacement,
        },
      ],
    };
  });

  const sarifDoc: SarifReport = {
    $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'CommitShield',
            semanticVersion: '1.2.0',
            informationUri: 'https://github.com/satyam-info/CommitShield',
            rules: ruleDefinitions,
          },
        },
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: scanResult.timestamp,
          },
        ],
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarifDoc, null, 2);
}

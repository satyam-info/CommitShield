import { describe, it, expect } from 'vitest';
import { generateRepoSarifReport, generateSnippetSarifReport } from './sarif';
import { scanRepository } from './repoEngine';
import { scanContent } from './engine';
import { DEMO_REPOSITORY_FILES, FICTIONAL_DUMMY_CREDENTIALS } from './fixtures';

describe('CommitShield SARIF 2.1.0 Export Generator', () => {
  it('generates valid SARIF 2.1.0 JSON matching the standard schema', () => {
    const repoResult = scanRepository(DEMO_REPOSITORY_FILES, 'demo-repo');
    const sarifJson = generateRepoSarifReport(repoResult);

    expect(sarifJson).toContain('"version": "2.1.0"');
    expect(sarifJson).toContain('https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json');

    const parsed = JSON.parse(sarifJson);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs).toHaveLength(1);

    const run = parsed.runs[0];
    expect(run.tool.driver.name).toBe('CommitShield');
    expect(run.tool.driver.rules.length).toBeGreaterThanOrEqual(7);

    // Verify results match scan findings
    expect(run.results.length).toBe(repoResult.allFindings.length);

    const firstResult = run.results[0];
    expect(firstResult.ruleId).toBeDefined();
    expect(firstResult.level).toMatch(/error|warning|note/);
    expect(firstResult.locations).toHaveLength(1);

    const loc = firstResult.locations[0].physicalLocation;
    expect(loc.artifactLocation.uri).toBeDefined();
    expect(loc.region.startLine).toBeGreaterThan(0);
    expect(loc.region.startColumn).toBeGreaterThan(0);
    expect(loc.region.endColumn).toBeGreaterThan(loc.region.startColumn);

    // Zero raw secret values exposed
    expect(sarifJson).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey);
    expect(sarifJson).not.toContain(FICTIONAL_DUMMY_CREDENTIALS.githubPat);
  });

  it('generates valid SARIF for snippet scans', () => {
    const code = `const key = "${FICTIONAL_DUMMY_CREDENTIALS.awsAccessKey}";`;
    const result = scanContent(code, { fileName: 'auth.ts' });
    const sarifJson = generateSnippetSarifReport(result);

    const parsed = JSON.parse(sarifJson);
    expect(parsed.runs[0].results).toHaveLength(1);
    expect(parsed.runs[0].results[0].ruleId).toBe('aws-access-key-id');
    expect(parsed.runs[0].results[0].level).toBe('error');
    expect(parsed.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('auth.ts');
  });
});

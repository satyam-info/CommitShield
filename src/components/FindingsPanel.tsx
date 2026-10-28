import React from 'react';
import { ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import type { ScanResult, SecretFinding, FileFinding } from '../scanner';
import { prioritizeFindings } from '../scanner';

interface FindingsPanelProps {
  scanResult: ScanResult | null;
  activeTab: 'findings' | 'redaction';
  onTabChange: (tab: 'findings' | 'redaction') => void;
  onSelectFinding?: (finding: SecretFinding) => void;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  scanResult,
  activeTab,
  onTabChange,
  onSelectFinding,
}) => {
  if (!scanResult) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <ShieldAlert size={16} />
            <span>Inspection & Findings</span>
          </div>
        </div>
        <div className="empty-state-box">
          <ShieldAlert size={36} strokeWidth={1.5} color="var(--text-muted)" />
          <p style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>No active scan</p>
          <p style={{ fontSize: '0.8125rem' }}>
            Paste code on the left or load a sample to inspect exposed secret patterns.
          </p>
        </div>
      </div>
    );
  }

  const { findings, summary } = scanResult;

  const fileFindings: FileFinding[] = findings.map((f) => ({
    ...f,
    filePath: scanResult.fileName || 'snippet.ts',
  }));
  const prioritized = prioritizeFindings(fileFindings);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldAlert size={16} />
          <span>Security Findings</span>
          <div className="segment-tabs" style={{ marginLeft: 8 }}>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
              onClick={() => onTabChange('findings')}
            >
              Findings ({summary.total})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'redaction' ? 'active' : ''}`}
              onClick={() => onTabChange('redaction')}
              disabled={findings.length === 0}
            >
              Remediation Diff
            </button>
          </div>
        </div>

        <div className="metrics-row">
          {summary.critical > 0 && (
            <span className="severity-badge severity-critical">
              <span className="dot" />
              {summary.critical} Critical
            </span>
          )}
          {summary.high > 0 && (
            <span className="severity-badge severity-high">
              <span className="dot" />
              {summary.high} High
            </span>
          )}
          {summary.medium > 0 && (
            <span className="severity-badge severity-medium">
              <span className="dot" />
              {summary.medium} Med
            </span>
          )}
          {summary.total === 0 && (
            <span className="severity-badge severity-safe">
              <span className="dot" />
              Clean
            </span>
          )}
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="clean-state-box">
          <div className="clean-state-icon">
            <ShieldCheck size={28} />
          </div>
          <h3 className="clean-state-title">Clean Scan — 0 Known Signatures Flagged</h3>
          <p className="clean-state-desc">
            No known credential patterns (AWS, GitHub, Google, Slack, Stripe, Private Keys, JWTs) were flagged by current heuristics.
          </p>
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Scanned {scanResult.scannedLines} lines locally. Always perform manual reviews before publishing.
          </div>
        </div>
      ) : (
        <div className="findings-list">
          {prioritized.map((f) => (
            <div
              key={f.id}
              className="finding-card"
              onClick={() => onSelectFinding?.(f)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectFinding?.(f);
                }
              }}
            >
              <div className="finding-header">
                <div className="finding-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className={`priority-badge priority-p${f.priorityRank}`}>
                    {f.priorityLabel}
                  </span>
                  <span className={`severity-badge severity-${f.severity}`}>
                    <span className="dot" />
                    {f.severity}
                  </span>
                  <span className="finding-name">{f.ruleName}</span>
                </div>
                <span className="location-pill">
                  Line {f.line}, Col {f.column}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', margin: '0.1rem 0', flexWrap: 'wrap' }}>
                <span className="meta-pill">{f.confidenceLabel}</span>
                <span className="meta-pill">{f.contextLabel}</span>
              </div>

              <div className="finding-evidence" title="Masked contextual line containing secret">
                {f.maskedEvidence}
              </div>

              <div className="finding-explanation" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface-subtle)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-tertiary)' }} />
                  <span>{f.explanation}</span>
                </div>
              </div>

              <div className="finding-remediation">
                <span>{f.description}</span>
                <span className="finding-replacement-code" title="Recommended environment variable placeholder">
                  {f.suggestedReplacement}
                </span>
              </div>

              <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontStyle: 'italic', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.3rem' }}>
                {f.evidenceDisclaimer}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer-banner">
        <strong>Security Notice:</strong> Pattern matching uses local deterministic heuristics. It flags standard credential patterns but cannot guarantee detection of all custom or obfuscated secrets.
      </div>
    </div>
  );
};

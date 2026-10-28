import React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ScanResult, SecretFinding } from '../scanner';

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
              Safe Redaction
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
          <h3 className="clean-state-title">Clean Scan — 0 Exposed Secrets Detected</h3>
          <p className="clean-state-desc">
            No known credential signatures (AWS, GitHub, Google, Slack, Stripe, Private Keys, JWTs) were flagged.
          </p>
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Scanned {scanResult.scannedLines} lines in local offline memory.
          </div>
        </div>
      ) : (
        <div className="findings-list">
          {findings.map((f) => (
            <div key={f.id} className="finding-card">
              <div className="finding-header">
                <div className="finding-title-group">
                  <span className={`severity-badge severity-${f.severity}`}>
                    <span className="dot" />
                    {f.severity}
                  </span>
                  <span className="finding-name">{f.ruleName}</span>
                </div>
                <span className="location-pill">
                  {scanResult.fileName ? `${scanResult.fileName}:` : ''}L{f.line}:C{f.column}
                </span>
              </div>

              <div className="finding-evidence" title="Masked contextual line containing secret">
                {f.maskedEvidence}
              </div>

              <div className="finding-remediation">
                <span>{f.description}</span>
                <span className="finding-replacement-code" title="Recommended environment variable placeholder">
                  {f.suggestedReplacement}
                </span>
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

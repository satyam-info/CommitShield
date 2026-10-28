import React from 'react';
import { ShieldCheck, ShieldAlert, FileCode } from 'lucide-react';
import type { RepositoryScanResult, FileFinding } from '../scanner';
import { groupFindingsByFile } from '../scanner';

interface RepoFindingsPanelProps {
  repoResult: RepositoryScanResult | null;
  activeTab: 'findings' | 'redaction';
  onTabChange: (tab: 'findings' | 'redaction') => void;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  activeFinding?: FileFinding | null;
  onSelectFinding?: (finding: FileFinding) => void;
}

export const RepoFindingsPanel: React.FC<RepoFindingsPanelProps> = ({
  repoResult,
  activeTab,
  onTabChange,
  selectedFile,
  onSelectFile,
  activeFinding,
  onSelectFinding,
}) => {
  if (!repoResult) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <ShieldAlert size={16} />
            <span>Repository Findings</span>
          </div>
        </div>
        <div className="empty-state-box">
          <ShieldAlert size={36} strokeWidth={1.5} color="var(--text-muted)" />
          <p style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>No repository loaded</p>
          <p style={{ fontSize: '0.8125rem' }}>
            Upload a .zip repository archive on the left or click 'Load Demo Repo' above to inspect.
          </p>
        </div>
      </div>
    );
  }

  const { allFindings, summary } = repoResult;
  const grouped = groupFindingsByFile(allFindings);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ShieldAlert size={16} />
          <span>Repository Security Findings</span>
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
              disabled={allFindings.length === 0}
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

      {allFindings.length === 0 ? (
        <div className="clean-state-box">
          <div className="clean-state-icon">
            <ShieldCheck size={28} />
          </div>
          <h3 className="clean-state-title">Clean Scan — 0 Known Signatures Flagged</h3>
          <p className="clean-state-desc">
            No known credential patterns were flagged across all {repoResult.totalFilesScanned} scanned repository files.
          </p>
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Scanned {repoResult.totalLinesScanned.toLocaleString()} lines locally. Always perform manual reviews before publishing.
          </div>
        </div>
      ) : (
        <div className="findings-list" style={{ maxHeight: '560px' }}>
          {Array.from(grouped.entries()).map(([filePath, fileFindings]: [string, FileFinding[]]) => (
            <div key={filePath} className="file-group">
              <div
                className="file-group-header"
                onClick={() => {
                  onSelectFile(filePath);
                  if (fileFindings.length > 0 && onSelectFinding) {
                    onSelectFinding(fileFindings[0]);
                  }
                }}
                style={{ cursor: 'pointer' }}
                title="Click to view file in editor and inspect first finding"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectFile(filePath);
                    if (fileFindings.length > 0 && onSelectFinding) {
                      onSelectFinding(fileFindings[0]);
                    }
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileCode size={14} />
                  <span>{filePath}</span>
                  {selectedFile === filePath && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                      (active)
                    </span>
                  )}
                </div>
                <span className="file-findings-count has-findings">
                  {fileFindings.length} {fileFindings.length === 1 ? 'finding' : 'findings'}
                </span>
              </div>

              <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fileFindings.map((f) => {
                  const isActive = activeFinding?.id === f.id;

                  return (
                    <div
                      key={f.id}
                      className={`finding-card ${isActive ? 'active-finding-card' : ''}`}
                      onClick={() => {
                        onSelectFile(f.filePath);
                        onSelectFinding?.(f);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelectFile(f.filePath);
                          onSelectFinding?.(f);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      title="Click to highlight in source code"
                    >
                      <div className="finding-header">
                        <div className="finding-title-group">
                          <span className={`severity-badge severity-${f.severity}`}>
                            <span className="dot" />
                            {f.severity}
                          </span>
                          <span className="finding-name">{f.ruleName}</span>
                        </div>
                        <span className="location-pill">L{f.line}:C{f.column}</span>
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
                  );
                })}
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

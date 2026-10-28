import React from 'react';
import { GitCommit, ExternalLink, AlertTriangle, ShieldCheck, Clock, User, FileCode } from 'lucide-react';
import type { GitHistoryScanResult, HistoricalCommitFinding } from '../scanner';

interface GitHistoryPanelProps {
  historyResult: GitHistoryScanResult;
  repoFullName?: string;
  activeTab?: 'findings' | 'redaction' | 'history';
  onTabChange?: (tab: 'findings' | 'redaction' | 'history') => void;
  findingsCount?: number;
}

export const GitHistoryPanel: React.FC<GitHistoryPanelProps> = ({
  historyResult,
  repoFullName,
  activeTab = 'history',
  onTabChange,
  findingsCount = 0,
}) => {
  const {
    commitsScanned,
    commitsWithFindings,
    totalHistoricalFindings,
    historicalOnlyFindingsCount,
    findings,
    isRateLimited,
    error,
  } = historyResult;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <GitCommit size={16} />
          <span>Historical Git Commit Scan</span>
          {onTabChange && (
            <div className="segment-tabs" style={{ marginLeft: 8 }}>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
                onClick={() => onTabChange('findings')}
              >
                Findings ({findingsCount})
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'redaction' ? 'active' : ''}`}
                onClick={() => onTabChange('redaction')}
              >
                Remediation Diff
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => onTabChange('history')}
              >
                Git History ({totalHistoricalFindings})
              </button>
            </div>
          )}
        </div>

        <div className="metrics-row">
          {totalHistoricalFindings > 0 ? (
            <span className="severity-badge severity-critical">
              <span className="dot" />
              {totalHistoricalFindings} Historical {totalHistoricalFindings === 1 ? 'Finding' : 'Findings'}
            </span>
          ) : (
            <span className="severity-badge severity-safe">
              <span className="dot" />
              0 Historical Exposures
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ margin: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'var(--high-bg)', color: 'var(--high-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {isRateLimited && (
        <div style={{ margin: '0.75rem', padding: '0.65rem 0.85rem', backgroundColor: 'var(--high-bg)', color: 'var(--high-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
          <strong>GitHub API Rate Limit Reached:</strong> Historical commit diff scanning was paused to avoid unauthenticated API blocks. You can inspect active HEAD files normally.
        </div>
      )}

      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-subtle)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Bounded History Inspection Scope:
          </span>
          <span className="panel-meta">
            {commitsWithFindings} of {commitsScanned} commits contained secret diffs
          </span>
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Scans added lines in recent unified commit diffs. Identifies credentials that were pushed to source control even if subsequent commits deleted them from the working tree.
        </div>
      </div>

      {historicalOnlyFindingsCount > 0 && (
        <div
          style={{
            margin: '0.75rem 1rem 0',
            padding: '0.75rem 1rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: '#92400e',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
            <AlertTriangle size={15} color="#b45309" />
            <span>
              {historicalOnlyFindingsCount} Lingering Secret {historicalOnlyFindingsCount === 1 ? 'Exposure' : 'Exposures'} Found in Git History
            </span>
          </div>
          <div style={{ fontSize: '0.6875rem', lineHeight: 1.5 }}>
            These credentials were deleted in later commits, but remain fully recoverable in the Git commit log. Anyone cloning the repository can extract them.
            <strong> Remediation:</strong> Rotate the key immediately and rewrite Git history (e.g. using <code>git filter-repo</code> or BFG Repo-Cleaner).
          </div>
        </div>
      )}

      {findings.length === 0 ? (
        <div className="clean-state-box" style={{ padding: '3rem 1.5rem' }}>
          <div className="clean-state-icon">
            <ShieldCheck size={28} />
          </div>
          <h3 className="clean-state-title">No Historical Secrets Flagged</h3>
          <p className="clean-state-desc">
            No known secret patterns were detected across the {commitsScanned} recent commit patches analyzed for {repoFullName || 'this repository'}.
          </p>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Note: Only a bounded sample of recent commits was inspected due to public API rate limits.
          </div>
        </div>
      ) : (
        <div className="findings-list" style={{ maxHeight: '520px', padding: '0.75rem 1rem' }}>
          {findings.map((f: HistoricalCommitFinding) => (
            <div key={f.id} className="finding-card" style={{ marginBottom: '0.75rem' }}>
              <div className="finding-header">
                <div className="finding-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {f.isHistoricalOnly ? (
                    <span className="priority-badge priority-p1" style={{ backgroundColor: '#fff7ed', color: '#c2410c', borderColor: '#ffedd5' }}>
                      Lingering in History
                    </span>
                  ) : (
                    <span className="priority-badge priority-p1">
                      Active in HEAD
                    </span>
                  )}

                  <span className={`severity-badge severity-${f.severity}`}>
                    <span className="dot" />
                    {f.severity}
                  </span>

                  <span className="finding-name">{f.ruleName}</span>
                </div>

                <a
                  href={f.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="location-pill"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none', color: 'inherit' }}
                  title="View commit diff on GitHub"
                >
                  <code>{f.shortSha}</code>
                  <ExternalLink size={11} />
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.6875rem', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <FileCode size={12} />
                  <code>{f.filePath}</code>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={12} />
                  <span>{f.author}</span>
                </span>
                {f.timestamp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} />
                    <span>{new Date(f.timestamp).toLocaleDateString()}</span>
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontStyle: 'italic', backgroundColor: 'var(--bg-surface-subtle)', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                "{f.commitMessage}"
              </div>

              <div className="finding-evidence" title="Masked patch addition">
                {f.maskedEvidence}
              </div>

              <div className="finding-remediation" style={{ marginTop: '0.2rem' }}>
                <span>Recommended variable replacement:</span>
                <span className="finding-replacement-code">
                  {f.suggestedReplacement}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer-banner">
        <strong>History Scope Disclaimer:</strong> Historical inspection examines a bounded window of recent commit diffs without downloading complete git packfiles. It detects secrets introduced in commit patches, but does not substitute for a full local history scan via <code>git log</code>.
      </div>
    </div>
  );
};

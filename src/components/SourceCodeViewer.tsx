import React, { useEffect, useRef } from 'react';
import { FileCode, Info } from 'lucide-react';
import type { SecretFinding, FileFinding, PrioritizedFinding } from '../scanner';

interface SourceCodeViewerProps {
  code: string;
  fileName?: string;
  activeFinding?: SecretFinding | FileFinding | PrioritizedFinding | null;
  onClearActiveFinding?: () => void;
}

export const SourceCodeViewer: React.FC<SourceCodeViewerProps> = ({
  code,
  fileName,
  activeFinding,
}) => {
  const highlightedLineRef = useRef<HTMLDivElement>(null);

  // Auto-scroll highlighted line into view when active finding changes
  useEffect(() => {
    if (highlightedLineRef.current) {
      highlightedLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeFinding]);

  if (!code && code !== '') {
    return (
      <div className="source-viewer empty">
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
          No file selected. Select a file from the repository tree to view code.
        </p>
      </div>
    );
  }

  // Handle completely empty files explicitly: 0 lines
  const lines = code === '' ? [] : code.split(/\r?\n/);
  const totalLines = lines.length;
  const targetLine = activeFinding ? activeFinding.line : undefined;

  return (
    <div className="source-viewer-wrapper">
      <div className="source-viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
          <FileCode size={14} />
          <span>{fileName || 'untitled'}</span>
          {activeFinding && (
            <span className="location-pill" style={{ marginLeft: 6 }}>
              Jumped to L{activeFinding.line}:C{activeFinding.column}
            </span>
          )}
        </div>

        <div className="panel-meta">
          <span>{totalLines} {totalLines === 1 ? 'line' : 'lines'}</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
          <span>{new TextEncoder().encode(code).length.toLocaleString()} bytes</span>
        </div>
      </div>

      <div className="source-code-scroll" tabIndex={0} aria-label={`Source code of ${fileName || 'file'}`}>
        {lines.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
            (Empty file — 0 bytes, 0 lines)
          </div>
        ) : (
          lines.map((lineContent, index) => {
            const lineNum = index + 1;
            const isHighlighted = targetLine === lineNum;

            return (
              <div
                key={lineNum}
                ref={isHighlighted ? highlightedLineRef : null}
                className={`source-line-row ${isHighlighted ? 'highlighted' : ''}`}
              >
                <div className="source-line-number" aria-hidden="true">
                  {lineNum}
                </div>
                <div className="source-line-content">
                  <code>{lineContent || ' '}</code>
                  {isHighlighted && activeFinding && (
                    <span className={`source-line-flag severity-${activeFinding.severity}`}>
                      ◄ {activeFinding.ruleName}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeFinding && (
        <div className="active-finding-inspector">
          <div className="finding-header" style={{ marginBottom: 4 }}>
            <div className="finding-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {'priorityRank' in activeFinding && (
                <span className={`priority-badge priority-p${activeFinding.priorityRank}`}>
                  {activeFinding.priorityLabel}
                </span>
              )}
              <span className={`severity-badge severity-${activeFinding.severity}`}>
                <span className="dot" />
                {activeFinding.severity}
              </span>
              <span className="finding-name">{activeFinding.ruleName}</span>
            </div>
            <span className="location-pill">
              Line {activeFinding.line}, Column {activeFinding.column}
            </span>
          </div>

          {'confidenceLabel' in activeFinding && (
            <div style={{ display: 'flex', gap: '0.4rem', margin: '0.2rem 0', flexWrap: 'wrap' }}>
              <span className="meta-pill">{activeFinding.confidenceLabel}</span>
              <span className="meta-pill">{activeFinding.contextLabel}</span>
            </div>
          )}

          <div className="finding-evidence" style={{ margin: '6px 0', fontSize: '0.75rem' }}>
            {activeFinding.maskedEvidence}
          </div>

          {'explanation' in activeFinding && (
            <div className="finding-explanation" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: '#fff', padding: '0.35rem 0.55rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', margin: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                <Info size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-tertiary)' }} />
                <span>{activeFinding.explanation}</span>
              </div>
            </div>
          )}

          <div className="finding-remediation" style={{ marginTop: 6 }}>
            <span>{activeFinding.description}</span>
            <span className="finding-replacement-code" title="Recommended environment variable placeholder">
              {activeFinding.suggestedReplacement}
            </span>
          </div>

          {'evidenceDisclaimer' in activeFinding && (
            <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontStyle: 'italic', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.3rem', marginTop: '0.4rem' }}>
              {activeFinding.evidenceDisclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

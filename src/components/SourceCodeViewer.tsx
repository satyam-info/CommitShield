import React, { useEffect, useRef } from 'react';
import { FileCode } from 'lucide-react';
import type { SecretFinding, FileFinding } from '../scanner';

interface SourceCodeViewerProps {
  code: string;
  fileName?: string;
  activeFinding?: SecretFinding | FileFinding | null;
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
            <div className="finding-title-group">
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

          <div className="finding-evidence" style={{ margin: '6px 0', fontSize: '0.75rem' }}>
            {activeFinding.maskedEvidence}
          </div>

          <div className="finding-remediation" style={{ marginTop: 6 }}>
            <span>{activeFinding.description}</span>
            <span className="finding-replacement-code" title="Recommended environment variable placeholder">
              {activeFinding.suggestedReplacement}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

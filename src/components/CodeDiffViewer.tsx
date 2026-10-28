import React, { useState } from 'react';
import { computeLineDiff } from '../scanner';
import { ArrowLeftRight, Columns, AlignJustify } from 'lucide-react';

interface CodeDiffViewerProps {
  originalCode: string;
  modifiedCode: string;
  fileName?: string;
}

export const CodeDiffViewer: React.FC<CodeDiffViewerProps> = ({
  originalCode,
  modifiedCode,
  fileName,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');

  const { lines, summary } = computeLineDiff(originalCode, modifiedCode);

  return (
    <div className="diff-viewer-wrapper">
      <div className="diff-viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
          <ArrowLeftRight size={14} />
          <span>Remediation Diff: <strong>{fileName || 'active file'}</strong></span>
          <span className="diff-stat-pill added">+{summary.linesAdded}</span>
          <span className="diff-stat-pill removed">-{summary.linesRemoved}</span>
        </div>

        <div className="segment-tabs">
          <button
            type="button"
            className={`tab-btn ${viewMode === 'unified' ? 'active' : ''}`}
            onClick={() => setViewMode('unified')}
            title="Unified line-by-line diff view"
          >
            <AlignJustify size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            <span>Unified</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            title="Side-by-side comparison view"
          >
            <Columns size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            <span>Side-by-Side</span>
          </button>
        </div>
      </div>

      {viewMode === 'unified' ? (
        <div className="diff-scroll-container" tabIndex={0} aria-label="Unified remediation diff">
          {lines.map((line, idx) => (
            <div key={idx} className={`diff-line-row diff-${line.type}`}>
              <div className="diff-gutter-num orig" aria-hidden="true">
                {line.originalLineNumber || ''}
              </div>
              <div className="diff-gutter-num mod" aria-hidden="true">
                {line.modifiedLineNumber || ''}
              </div>
              <div className="diff-marker" aria-hidden="true">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
              </div>
              <div className="diff-code-content">
                <code>{line.content || ' '}</code>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="diff-split-container">
          <div className="diff-split-pane original">
            <div className="diff-pane-title">Original (Exposed)</div>
            <div className="diff-scroll-container" tabIndex={0} aria-label="Original file content">
              {(originalCode === '' ? [] : originalCode.split(/\r?\n/)).map((l, idx) => {
                const isModified = lines.some(
                  (dl) => dl.type === 'removed' && dl.originalLineNumber === idx + 1
                );
                return (
                  <div key={idx} className={`diff-line-row ${isModified ? 'diff-removed' : 'diff-unchanged'}`}>
                    <div className="diff-gutter-num orig">{idx + 1}</div>
                    <div className="diff-code-content">
                      <code>{l || ' '}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="diff-split-pane modified">
            <div className="diff-pane-title">Remediated (Sanitized)</div>
            <div className="diff-scroll-container" tabIndex={0} aria-label="Sanitized file content">
              {(modifiedCode === '' ? [] : modifiedCode.split(/\r?\n/)).map((l, idx) => {
                const isAdded = lines.some(
                  (dl) => dl.type === 'added' && dl.modifiedLineNumber === idx + 1
                );
                return (
                  <div key={idx} className={`diff-line-row ${isAdded ? 'diff-added' : 'diff-unchanged'}`}>
                    <div className="diff-gutter-num mod">{idx + 1}</div>
                    <div className="diff-code-content">
                      <code>{l || ' '}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

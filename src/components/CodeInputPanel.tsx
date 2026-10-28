import React, { useRef, useState } from 'react';
import { UploadCloud, Play, FileCode, AlertCircle, X } from 'lucide-react';

interface CodeInputPanelProps {
  code: string;
  fileName?: string;
  onCodeChange: (newCode: string) => void;
  onFileNameChange: (name?: string) => void;
  onScan: () => void;
  isScanning: boolean;
}

const SUPPORTED_EXTENSIONS = [
  '.env', '.txt', '.json', '.js', '.jsx', '.ts', '.tsx',
  '.py', '.yaml', '.yml', '.toml', '.sh', '.bash', '.cfg', '.conf', '.md'
];

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const CodeInputPanel: React.FC<CodeInputPanelProps> = ({
  code,
  fileName,
  onCodeChange,
  onFileNameChange,
  onScan,
  isScanning,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const lineCount = code ? code.split(/\r?\n/).length : 0;
  const charCount = code.length;

  const handleFileUpload = (file: File) => {
    setFileError(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File exceeds maximum size of 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isSupported =
      SUPPORTED_EXTENSIONS.includes(ext) ||
      file.name.startsWith('.env') ||
      file.type.startsWith('text/') ||
      file.type === 'application/json';

    if (!isSupported && !file.name.startsWith('.')) {
      setFileError(`Unsupported file format. Please upload text, code, or configuration files.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        onCodeChange(content);
        onFileNameChange(file.name);
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read file. Please ensure the file is plain text.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to trigger scan
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onScan();
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <FileCode size={16} />
          <span>Input Code or File</span>
          {fileName && (
            <span className="location-pill" title="Current uploaded file">
              {fileName}
              <button
                type="button"
                onClick={() => onFileNameChange(undefined)}
                style={{ marginLeft: 4, display: 'inline-flex', verticalAlign: 'middle' }}
                title="Detach file reference"
              >
                <X size={10} />
              </button>
            </span>
          )}
        </div>
        <div className="panel-meta">
          <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
          <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>
          <span>{charCount.toLocaleString()} chars</span>
        </div>
      </div>

      <div
        className={`dropzone-overlay ${dragActive ? 'active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        title="Click to browse or drop a text file here"
      >
        <UploadCloud size={16} />
        <span>Drop project files (.env, .json, .ts, .py, .yaml) or click to browse</span>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
      </div>

      {fileError && (
        <div style={{ margin: '0 0.75rem 0.5rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--critical-bg)', color: 'var(--critical-text)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={14} />
          <span>{fileError}</span>
        </div>
      )}

      <div className="editor-container">
        <textarea
          id="code-input"
          aria-label="Code input for secret scanning"
          className="code-textarea"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="// Paste source code, configuration, or environment contents here to scan for exposed secrets...&#10;// Keyboard shortcut: Ctrl + Enter / Cmd + Enter to scan."
          spellCheck={false}
        />
      </div>

      <div className="disclaimer-banner">
        Deterministic pattern scanning operates 100% locally in your browser. No source code or detected credentials are ever transmitted.
      </div>

      <div className="panel-footer">
        <span>Shortcut: <strong>Ctrl/Cmd + Enter</strong> to scan</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onScan}
          disabled={isScanning || !code.trim()}
        >
          <Play size={14} />
          <span>{isScanning ? 'Scanning...' : 'Scan for Secrets'}</span>
        </button>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { Header } from './components/Header';
import { CodeInputPanel } from './components/CodeInputPanel';
import { FindingsPanel } from './components/FindingsPanel';
import { RedactionPanel } from './components/RedactionPanel';
import { ExportModal } from './components/ExportModal';
import {
  scanContent,
  SAMPLE_VULNERABLE_CODE,
  SAFE_CODE_SAMPLE,
  type ScanResult,
} from './scanner';
import './App.css';

export const App: React.FC = () => {
  const [code, setCode] = useState<string>(SAMPLE_VULNERABLE_CODE);
  const [fileName, setFileName] = useState<string | undefined>('demo_config.ts');
  const [scanResult, setScanResult] = useState<ScanResult | null>(() =>
    scanContent(SAMPLE_VULNERABLE_CODE, { fileName: 'demo_config.ts' })
  );
  const [activeTab, setActiveTab] = useState<'findings' | 'redaction'>('findings');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  const handleScan = () => {
    setIsScanning(true);
    // Instant microtask scan with tiny UI pulse
    setTimeout(() => {
      const result = scanContent(code, { fileName });
      setScanResult(result);
      setIsScanning(false);
      // Auto-switch to findings if new findings detected
      if (result.findings.length > 0) {
        setActiveTab('findings');
      }
    }, 40);
  };

  const handleLoadVulnerableSample = () => {
    setCode(SAMPLE_VULNERABLE_CODE);
    setFileName('sample_vulnerable.ts');
    const result = scanContent(SAMPLE_VULNERABLE_CODE, { fileName: 'sample_vulnerable.ts' });
    setScanResult(result);
    setActiveTab('findings');
  };

  const handleLoadSafeSample = () => {
    setCode(SAFE_CODE_SAMPLE);
    setFileName('safe_production_code.ts');
    const result = scanContent(SAFE_CODE_SAMPLE, { fileName: 'safe_production_code.ts' });
    setScanResult(result);
    setActiveTab('findings');
  };

  const handleClear = () => {
    setCode('');
    setFileName(undefined);
    setScanResult(null);
    setActiveTab('findings');
  };

  const handleApplyToEditor = (sanitizedCode: string) => {
    setCode(sanitizedCode);
    const result = scanContent(sanitizedCode, { fileName });
    setScanResult(result);
    setActiveTab('findings');
  };

  const handleRescanRedacted = (_sanitizedCode: string, rescanResult: ScanResult) => {
    setScanResult(rescanResult);
  };

  return (
    <div className="app-container">
      <Header
        onLoadVulnerableSample={handleLoadVulnerableSample}
        onLoadSafeSample={handleLoadSafeSample}
        onClear={handleClear}
        hasFindings={Boolean(scanResult && scanResult.findings.length > 0)}
        onOpenExport={() => setShowExportModal(true)}
      />

      <main className="workspace-grid">
        <CodeInputPanel
          code={code}
          fileName={fileName}
          onCodeChange={setCode}
          onFileNameChange={setFileName}
          onScan={handleScan}
          isScanning={isScanning}
        />

        {activeTab === 'findings' ? (
          <FindingsPanel
            scanResult={scanResult}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        ) : scanResult ? (
          <RedactionPanel
            originalCode={code}
            scanResult={scanResult}
            onApplyToEditor={handleApplyToEditor}
            onRescanRedacted={handleRescanRedacted}
          />
        ) : (
          <FindingsPanel
            scanResult={scanResult}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </main>

      <footer className="app-footer">
        <div>
          <strong>CommitShield</strong> — Offline Secret Prevention for Developers
        </div>
        <div>
          Zero cloud data transfer / Client-side heuristic inspection
        </div>
      </footer>

      {showExportModal && scanResult && (
        <ExportModal
          scanResult={scanResult}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
};

export default App;

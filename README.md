# CommitShield

> **Lightweight, Zero-Knowledge Developer Secret Scanner & Repository-Level Security Tool**

CommitShield is a fast, offline developer security tool built to prevent accidental credential leakage in individual files and entire project repositories (`.zip`). Designed with Apple-inspired visual restraint and Google-inspired functional clarity, it prioritizes real developer utility over decorative dashboard noise.

---

## ⚡ 2-Minute Hackathon Demo Flow

> **Presentation Script:** See [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the exact 120-second judge presentation script covering the problem, solution, privacy guarantees, and product differentiation.

1. **Repository Mode (.zip) or Snippet Mode:**
   Use the mode switcher in the navigation bar to toggle between **"Code Snippet"** (paste or single-file scan) and **"Repository (.zip)"** (full multi-file project analysis).
2. **Inspect Vulnerable Repository:**
   In Repository mode, click **"Vulnerable Repo"** (or drop a project `.zip`). CommitShield extracts files locally and scans every source file recursively.
3. **Repository Overview & Skipped Files:**
   Review the repository stats: files scanned, non-text files skipped (binaries, `node_modules`, `.git` folders), and findings grouped by file path (`src/config/aws.ts`, `src/auth/github.ts`, `src/payments/stripe.ts`).
4. **Zero-Knowledge Evidence Masking:**
   Notice that **raw secrets are never displayed or stored**; they are masked (`AKIA**************LE`) with exact file, line, and column coordinates (`L6:C17`), severity classification, and suggested environment variable replacements.
5. **Safe Redaction & Rescan:**
   Click the **"Safe Redaction"** tab. Preview sanitized files with **Placeholders** (`<REDACTED_AWS_ACCESS_KEY_ID>`) or **Env Variables** (`process.env.AWS_ACCESS_KEY_ID`). Click **"Rescan Clean Repo"** to verify that zero heuristic pattern matches remain.
6. **Download Sanitized ZIP & Audit Report:**
   Download the cleaned repository as a new ZIP, or click **"Export Report"** to generate a comprehensive Markdown audit report (`COMMITSHIELD_REPO_REPORT.md`) or structured JSON log.
7. **Clean Verification State:**
   Click **"Safe Repo"** to test production code with environment variables and public client IDs (`clientId`, `apiUrl`), confirming zero false positives.

---

## 🛡️ Supported Credential Signatures

CommitShield provides deterministic, regex-based heuristic pattern matching across common credential formats:

| Rule Name | Severity | Format Detected | Suggested Replacement |
| :--- | :---: | :--- | :--- |
| **AWS Access Key ID** | `Critical` | `AKIA`, `ABIA`, `ACCA`, `ASIA` 20-character identifiers | `process.env.AWS_ACCESS_KEY_ID` |
| **GitHub Token** | `Critical` | `ghp_`, `github_pat_`, `gho_`, `ghs_` access tokens | `process.env.GITHUB_TOKEN` |
| **Google API Key** | `High` | 39-character `AIza...` Google Cloud & Firebase keys | `process.env.GOOGLE_API_KEY` |
| **Slack API Token** | `High` | `xoxb-`, `xoxp-`, `xapp-`, `xoxa-` bot and integration tokens | `process.env.SLACK_BOT_TOKEN` |
| **Stripe Secret Key** | `Critical` | `sk_live_`, `rk_live_`, `sk_test_` payment API keys | `process.env.STRIPE_SECRET_KEY` |
| **Private Key Header** | `Critical` | Cryptographic key blocks (`BEGIN RSA/EC/OPENSSH/PRIVATE KEY`) | `process.env.PRIVATE_KEY` |
| **JSON Web Token (JWT)** | `Medium` | Encoded 3-part authorization tokens (`eyJhbGciOi...`) | `process.env.BEARER_AUTH_TOKEN` |
| **Generic Secret Assignment** | `High` | Hardcoded assignments to `apiSecret`, `clientSecret`, `accessToken`, `authToken`, `apiKey`, `password` | Contextual `process.env.*` variable |

### False-Positive Filtering
Ordinary configuration values are explicitly excluded from generic secret detection:
- Public identifiers: `clientId`, `appId`, `userId`.
- URLs and endpoints: `apiUrl`, `baseUrl`, `endpoint`, `http://...`, `https://...`.
- Code placeholders: `YOUR_API_KEY`, `your_token_here`, `TODO`, `CHANGEME`, `insert_here`.
- Environment variable calls: `process.env.*`, `import.meta.env.*`, `${VAR}`.
- Low-entropy strings: `0000000000000000`, `****************`.

---

## 🔒 Security & Privacy Architecture

- **100% Client-Side Execution:** Scanning, redaction, and archive extraction run entirely in the browser memory using `jszip`. Zero code, archive contents, or credentials are sent over the wire.
- **Safe Archive Handling (Zip-Slip Protection):**
  - Path traversal sequences (`../`, leading `/`, drive letters) are rejected immediately.
  - Limits enforced: 25 MB max compressed archive size, 50 MB total extracted text, 5 MB single file limit, 1,000 files maximum.
  - Automatic filtering of dependency and cache directories (`node_modules`, `.git`, `dist`, `__pycache__`).
  - Binary filtering: skips compiled binaries, images, audio, video, fonts, and files containing null bytes (`\0`).
- **Zero LocalStorage Persistence:** Sensitive code and findings are kept in volatile React state and are never written to `localStorage` or `sessionStorage`.
- **Safe Evidence Masking:** Raw secret matches are masked at the engine level before being assigned to findings. Reports and UI views never echo unmasked values.
- **Filename Sanitization:** Uploaded file names containing credential patterns are sanitized before inclusion in export reports.
- **Strict Boundary Redaction:** Replacements are executed in reverse column order per line, preserving surrounding code, comments, and non-secret strings without corruption.

---

## ⚠️ Limitations & Honesty Policy

- **Heuristic Detection:** CommitShield relies on deterministic pattern matching and known signature formats. It cannot detect arbitrary, highly obfuscated, or custom proprietary secrets.
- **Scope of Verification:** A clean rescan indicates that no configured heuristic patterns matched the content; it does not replace comprehensive manual code review or defense-in-depth secrets management (e.g. AWS Secrets Manager, HashiCorp Vault).

---

## 🚀 Development & Installation

### Prerequisites
- Node.js `v20+` or `v24+`
- npm (on Windows PowerShell, invoke via `npm.cmd`)

### Setup
```powershell
# Clone repository
git clone https://github.com/satyam-info/CommitShield.git
cd CommitShield

# Install dependencies
npm.cmd install
```

### Run Tests
```powershell
# Run complete Vitest suite (positive, negative, line-offset, masking, redaction, reports)
npm.cmd test
```

### Local Development Server
```powershell
npm.cmd run dev
```

### Production Build
```powershell
npm.cmd run build
npm.cmd run preview
```

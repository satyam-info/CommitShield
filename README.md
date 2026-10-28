# CommitShield

> **Lightweight, Zero-Knowledge Developer Secret Scanner & Redaction Tool**

CommitShield is a fast, offline developer security tool built to prevent accidental credential leakage in commits, pull requests, and config files. Designed with Apple-inspired visual restraint and Google-inspired functional clarity, it prioritizes real developer utility over decorative dashboard noise.

---

## ⚡ 2-Minute Hackathon Demo Flow

1. **Inspect Vulnerable Code:**
   Click **"Vulnerable Sample"** in the top navigation bar. CommitShield pre-loads a realistic multi-service snippet with synthetic dummy credentials.
2. **Review Masked Findings:**
   Observe the findings list on the right. Notice that **raw secrets are never displayed or stored**; they are masked (`AKIA**************LE`) with exact file line and column coordinates (`L6:C17`), severity classification, and suggested environment variable replacements.
3. **Preview Safe Redaction:**
   Click the **"Safe Redaction"** tab. Toggle between **"Placeholders"** (`<REDACTED_AWS_ACCESS_KEY_ID>`) and **"Env Variables"** (`process.env.AWS_ACCESS_KEY_ID`) without mutating the original source.
4. **Rescan & Verify:**
   Click **"Rescan Redacted Code"**. The scanner re-evaluates the sanitized buffer and displays the verified clean status indicating zero remaining heuristic pattern matches.
5. **Export Report:**
   Click **"Export Report"** to inspect and download a structured Markdown audit report (`COMMITSHIELD_REPORT.md`) or JSON log (`commitshield-report.json`) safe for team distribution.
6. **Clean Verification State:**
   Click **"Safe Sample"** to load standard production code using environment variables and UUIDs, showing the verified clean-scan shield.

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
| **Generic Secret Assignment** | `High` | Hardcoded assignments to `api_key`, `secret_key`, `password` | `process.env.CONFIGURED_SECRET` |

---

## 🔒 Security & Privacy Architecture

- **100% Client-Side Execution:** Scanning, redaction, and reporting run entirely in the browser memory. Zero code, file content, or credentials are sent over the network.
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

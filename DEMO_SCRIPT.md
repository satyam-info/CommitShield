# CommitShield — 2-Minute Demo & Presentation Script

> **Target Audience:** Hackathon Judges, Security Engineers, and Developers  
> **Target Duration:** Exactly 2 Minutes (120 seconds)

---

### [0:00 – 0:25] The Problem & Target Users
*"Every developer has had that heart-stopping moment: accidentally committing an `.env` file, AWS key, or Stripe secret to GitHub. Public GitHub push protection catches some tokens, but private repositories, staging repos, and other services remain completely unprotected until it's too late.*

*Existing tools either require complex CLI installs or ask developers to paste confidential company code into third-party cloud AI dashboards—which itself constitutes a major security leak.*

*CommitShield was built for developers who need instant, pre-commit credential detection with absolute zero-knowledge privacy."*

---

### [0:25 – 1:10] The Live Product Walkthrough

1. **Detection (0:25 - 0:40):**  
   *(Click "Vulnerable Sample" in the top bar)*  
   *"Here we have a realistic application file. In sub-millisecond time, CommitShield's offline engine flags 5 distinct credential types: an AWS Access Key, a GitHub PAT, a Google API Key, a Stripe Secret Key, and a Slack Token.*  
   *Notice the restraint: no distracting animations. We see exact line and column coordinates, severity levels, and crucially—**the raw secret is never displayed or logged**; evidence is masked at the engine level."*

2. **Safe Redaction & Verification (0:40 - 0:55):**  
   *(Click the "Safe Redaction" tab)*  
   *"Instead of manually hunting for replacements, developers can preview safe redaction in two modes: standard `<REDACTED_TYPE>` placeholders, or production environment variable bindings like `process.env.AWS_ACCESS_KEY_ID`.*  
   *(Click "Rescan Redacted Code")*  
   *We click 'Rescan', and CommitShield immediately re-evaluates the buffer, confirming zero known signatures remain."*

3. **Export & Clean State (0:55 - 1:10):**  
   *(Click "Export Report", then click "Safe Sample")*  
   *"With one click, we can export a clean Markdown or JSON audit log safe for PR descriptions. And when we load clean production code, we get an instant, verified green pass."*

---

### [1:10 – 1:40] Privacy Architecture & Key Differentiators

*"What makes CommitShield uniquely trustworthy?*
- **100% Client-Side:** Every scan, redaction, and report runs entirely in local browser memory. Not a single byte of source code leaves the machine.
- **Zero Local Storage:** We do not write code or detected tokens to `localStorage` or `sessionStorage`. Closing the tab wipes everything.
- **Engine-Level Masking:** Masking isn't a CSS trick; unmasked secret strings are never retained in finding objects.
- **Boundary-Safe Redaction:** Replacements execute in reverse-column order per line, guaranteeing surrounding code and comments are never corrupted."*

---

### [1:40 – 2:00] Limitations & Closing

*"An honest disclaimer: CommitShield uses deterministic heuristic pattern matching. It reliably catches standard signature structures, but no regex scanner can claim 100% omniscience for custom or obfuscated secrets. It is designed as an accessible, zero-friction first line of defense.*

*CommitShield: Simple. Fast. Private. Developer security without the cloud compromise. Thank you!"*

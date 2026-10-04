# Workspace Rules & Instructions

## 1. Local Development Guide Maintenance (MANDATORY)
- Whenever any new API endpoint, proxy route, port, background job, CLI command, or UI feature is added, modified, or deprecated, you **MUST** update [`LOCAL_DEV_GUIDE.md`](file:///Users/jinayshah/Downloads/smart%20adv%20system%20repo/AI-Smart-Agriculture-System/LOCAL_DEV_GUIDE.md) immediately in the same turn.
- Keep quick links, URLs, ports, and curl test examples accurate, working, and up-to-date at all times.

## 2. Data Integrity & Provenance
- Never fabricate data or numbers. If reference cost or market data is missing, return `null` with a clear explanation.
- Always include `cost_year`, `as_of`, `source`, and methodology notices.
- Explicitly refuse non-storable crops (e.g., Sugarcane, Tomato) in storage estimators.

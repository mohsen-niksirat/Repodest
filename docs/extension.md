# Making Repodest a Chrome Extension

The app is already 100% client-side with zero build step — that makes it an
almost perfect candidate for a Chrome extension (MV3). Here is exactly what is
needed, from quickest to most polished.

## Why it's easy for Repodest

- No backend, no build tooling → the `manifest.json` + files can ship as-is
- All state is `localStorage`/IndexedDB → works inside an extension page
- CSP-safe: no `eval` in production paths, CDNs are loaded via dynamic
  `<script>` tags (Chart.js / html2canvas) — must be bundled locally for MV3

## Option 1 — Minimal wrapper (30 minutes of work)

```
extension/
├── manifest.json        # MV3 manifest
├── popup.html           # thin shell that loads Repodest
├── popup.js             # optional: open full view in a tab
└── icons/               # 16/48/128 px PNGs
```

`extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Repodest — GitHub Repo Analyzer",
  "version": "1.0.0",
  "description": "Health score, file explorer, PR analytics and LLM-ready digests for any GitHub repo.",
  "permissions": [],
  "action": { "default_popup": "popup.html", "default_icon": "icons/128.png" },
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

`popup.html` just inlines the current `index.html` content (all files copied
next to it: `core.js`, `app.js`, `styles.css`, `sw.js` removed — service
workers are not allowed in extension popups).

**What breaks and the fix:**

| Issue in MV3 | Fix |
|---|---|
| CDN `<script>` injection (Chart.js, html2canvas) blocked by CSP | Vendor the two libs into the extension folder, load them locally |
| Service worker (`sw.js`) not supported for extension pages | Skip registration inside extension (`if (!chrome.runtime?.id)`) |
| `raw.githubusercontent.com` fetches need host permission | Add `"host_permissions": ["https://api.github.com/*", "https://raw.githubusercontent.com/*", "https://api.osv.dev/*", "https://gitlab.com/*", "https://bitbucket.org/*"]` |

## Option 2 — GitHub-injected button (the killer feature)

Add a **content script** that puts an "🧪 Analyze" button on every GitHub repo
page. The popup then opens Repodest (extension tab or site) for that repo:

```json
"content_scripts": [{
  "matches": ["https://github.com/*/*"],
  "js": ["inject.js"],
  "run_at": "idle"
}]
```

`inject.js` (sketch):

```js
const m = location.pathname.match(/^\/([^/]+)\/([^/]+)/);
if (m && !document.getElementById('repodest-btn')) {
  const a = document.createElement('a');
  a.id = 'repodest-btn';
  a.textContent = '🧪 Analyze with Repodest';
  a.href = '#';
  a.style.cssText = 'margin-left:8px;font-size:12px;font-weight:600;';
  a.onclick = (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ repo: m[1] + '/' + m[2] });
  };
  document.querySelector('.Layout-main nav, [data-selector="repo-header"]')?.appendChild(a);
}
```

Background service worker receives the message and opens
`popup.html?repo=owner/repo` in a new tab. `boot()` already reads `?repo=`,
so no changes to the app core are needed.

## Option 3 — Publish on the Chrome Web Store

Checklist before shipping:

1. **Bundle CDN deps locally** (Chart.js 4.4.0, html2canvas 1.4.1) — external
   scripts violate MV3 CSP
2. **Swap Google Fonts** for `@font-face` + local woff2 (CSP again)
3. Remove `sw.js` registration when `chrome.runtime.id` exists
4. Add `popup.js` → "open full dashboard in tab" (popups are 800×600 max)
5. Zip → [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   → one-time $5 fee → submit for review
6. Privacy: disclose GitHub API + OSV.dev calls; no analytics = smooth review

Estimated total effort: **option 1 ≈ half a day, option 2 ≈ one day,
option 3 review ≈ 1–3 business days**.

# Repodest Documentation

## Table of Contents

- [Getting Started](#getting-started)
- [Features](#features)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [FAQ](#faq)

## Getting Started

Repodest is a client-side web application. No build step required.

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/mohsen-niksirat/repodest.git
   cd repodest
   ```

2. Open `index.html` in your browser, or serve it locally:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```

3. Run the tests:
   ```bash
   node tests.test.js
   ```

## Features

### Health Score
Analyzes 10 weighted criteria to produce a health score (0-100):
- Description (5 pts)
- Topics (10 pts)
- License (15 pts)
- README (15 pts)
- .gitignore (5 pts)
- CI workflows (15 pts)
- Tests (15 pts)
- Docs folder (5 pts)
- Contributing guide (5 pts)
- Active ≤6 months (10 pts)

### LLM Digest Generator
Select files from the repository tree, generate a formatted prompt with metadata, README, file tree, and full file contents. Supports token estimation and size guardrails.

### Multi-Platform Support
Works with GitHub, GitLab, and Bitbucket repositories.

### Dark/Light Theme
Toggle between dark and light themes with persistent preference in localStorage.

## Architecture

```
repodest/
├── index.html          # HTML structure (462 lines)
├── styles.css          # All CSS styles (694 lines)
├── app.js              # All JavaScript (2910 lines)
├── sw.js               # Service worker for PWA caching
├── manifest.json       # PWA manifest
├── tests.test.js       # Unit tests (71 tests)
├── docs/               # Documentation
├── .github/workflows/  # CI/CD pipeline
├── LICENSE             # MIT License
├── .gitignore          # Git ignore rules
└── README.md           # Multi-language README
```

### Key Design Decisions
- **Zero build step**: No bundler, no transpiler. Pure HTML/CSS/JS.
- **Client-side only**: No backend. All API calls go directly to GitHub/GitLab/Bitbucket.
- **PWA-ready**: Service worker caches the app shell for offline use.
- **Single-page application**: All routing via URL parameters.

## API Reference

### Core Functions (app.js)

| Function | Description |
|----------|-------------|
| `healthCheck(paths, meta)` | Calculate repo health score |
| `parseRepoInput(v)` | Parse repo URL/owner/repo input |
| `detectPlatform(input)` | Detect GitHub/GitLab/Bitbucket |
| `parseTree(apiTree)` | Parse Git tree API response |
| `asciiTree(paths)` | Render file tree as ASCII art |
| `generateDigest()` | Generate LLM-ready prompt |
| `esc(s)` | HTML entity escaping |
| `fmt(n)` | Number formatting (1.5k, 2.5M) |
| `fmtSize(b)` | Byte formatting (1.5 KB, 2.0 MB) |

### Event Handlers

| Handler | Trigger |
|---------|---------|
| `submitInput()` | Search button click / Enter key |
| `switchTab(name)` | Tab button click |
| `toggleTheme()` | Theme toggle button click |
| `cycleLang()` | Language toggle button click |

## Deployment

### GitHub Pages (Recommended)

The CI workflow (`.github/workflows/ci.yml`) automatically deploys to GitHub Pages on push to `main`.

### Manual Deployment

Simply push the files to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Any HTTP server

## FAQ

### Q: Do I need an API key?
A: No. Repodest works without any API key. However, a GitHub Personal Access Token increases the rate limit from 60 to 5,000 requests/hour.

### Q: Is my data sent anywhere?
A: No. All processing happens in your browser. The only external calls are to the GitHub/GitLab/Bitbucket APIs.

### Q: Can I use this offline?
A: Yes. After the first load, the service worker caches the app shell for offline use. However, API calls require an internet connection.

### Q: How do I add a new language to the i18n system?
A: Add a new key to the `I18N` object in `app.js`. See the existing `en` and `fa` entries for the format.

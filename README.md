# 🧪 Repodest

**Know a GitHub repo in seconds — then feed it to any LLM.**

Paste any repository or profile URL. Repodest gives you a health score, language breakdown, file explorer, commit insights and fun trophies — then packs selected files into an **LLM-ready digest** you can paste straight into ChatGPT, Claude or Gemini.

> Inspired by [Gitingest](https://gitingest.com) + GitHub Wrapped. 100% client-side: no backend, no tracking, no API key required.

### 🔗 Live: `https://mohsen-niksirat.github.io/repodest/`

## ✨ Features

### 📊 Analysis
- 🩺 **Health Score** — 10 weighted checks (license, README, tests, CI, docs, freshness…) with an animated score ring
- 🗣️ **Language Breakdown** — byte-accurate bar + doughnut chart
- 🧰 **Dependency Scan** — parses `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`, `Gemfile`, `pom.xml` straight from raw content
- 🗂️ **File Explorer** — lazy-rendered tree with sizes, type distribution and the heaviest files
- 📈 **Activity** — 52-week commit chart, top contributors, recent commits

### 🤖 The Digest (the Gitingest trick)
- Tick files/folders in the tree (or "All text files") → **Generate** → get a formatted prompt with repo metadata, README, file tree and full file contents
- Live token estimate (~chars ÷ 4), size guardrails, lockfile/binary skipping
- Copy to clipboard or download as `.md`

### 🏆 Fun Mode
- 8+ repo personalities ("The Memory Guardian", "The Data Alchemist"…)
- 🔥 **Roast mode** — rerollable repo-specific roasts
- 16 unlockable trophies

### 📸 Share
- Deep links (`?repo=owner/name`) — results are shareable
- PNG share card (html2canvas), one-click tweet, printable A4 report

### ⚙️ Practical details
- **Caching** — repo data cached 6h in localStorage (instant reloads, fewer API calls)
- **Rate-limit aware** — live remaining-calls chip; optional PAT stored only in localStorage (60 → 5,000 req/h)
- **Smart input** — accepts full URLs, `owner/repo`, or just a username (shows a repo picker)
- **Responsive** — desktop, tablet, mobile; keyboard + dark theme

## 🚀 Use it
1. Open the live link (or `index.html` locally)
2. Paste `owner/repo`, a GitHub URL, or a username
3. Explore the tabs; tick files in **Files** → generate your **Digest**

## 🛠️ Tech
HTML5 · CSS3 · Vanilla JS · Chart.js · html2canvas · GitHub REST API · zero build step, single file.

## 📄 License
MIT

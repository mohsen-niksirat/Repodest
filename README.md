# 🧪 Repodest

**Know a GitHub repo in seconds — then feed it to any LLM.**

[![GitHub](https://img.shields.io/badge/GitHub-Source-blue?logo=github)](https://github.com/mohsen-niksirat/repodest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/mohsen-niksirat/repodest/pulls)

> 🔗 **Live:** [https://mohsen-niksirat.github.io/repodest/](https://mohsen-niksirat.github.io/repodest/)

---

## 🌐 Languages / زبان‌ها

| | Language | Link |
|---|----------|------|
| 🇬🇧 | [English](#-english) | [README](#-english) |
| 🇮🇷 | [فارسی](#-فارسی) | [README](#-فارسی) |
| 🇪🇸 | [Español](#-español) | [README](#-español) |
| 🇨🇳 | [中文](#-中文) | [README](#-中文) |
| 🇫🇷 | [Français](#-français) | [README](#-français) |

---

# 🇬🇧 English

## ✨ What is Repodest?

Repodest is a **client-side GitHub repository analyzer** and **LLM-ready digest generator**. Paste any GitHub URL, get a health score, language breakdown, file explorer, commit insights, and fun trophies — then pack selected files into a prompt you can paste straight into ChatGPT, Claude, or Gemini.

> 100% client-side: no backend, no tracking, no API key required.

### 🩺 Health Score
10 weighted checks (license, README, tests, CI, docs, freshness) distilled into one honest number with an animated score ring.

### 📊 Language Breakdown
Byte-accurate bar + doughnut chart showing the true composition of the codebase.

### 🤖 LLM Digest
Select files in the tree → Generate → get a formatted prompt with repo metadata, README, file tree, and full file contents. Live token estimate, size guardrails, lockfile/binary skipping.

### 🗂️ File Explorer
Lazy-rendered tree with sizes, type distribution, and the heaviest files in the repo.

### 📈 Activity
52-week commit chart, top contributors, recent commits, star history.

### 🏆 Fun Mode
8+ repo personalities, 🔥 roast mode with rerollable roasts, 16 unlockable trophies.

### ⚔️ Battle Mode
Compare two repos side-by-side with automatic winner highlighting.

### 📸 Share
Deep links, PNG share cards, tweet button, printable A4 report.

### 🔒 Security Scan
Quick scan for exposed credentials, `.env` files, private keys, and best practices.

### ⚙️ Practical Details
- **Caching** — repo data cached 6h in localStorage
- **Rate-limit aware** — optional PAT for 5,000 req/h
- **Multi-platform** — GitHub, GitLab, Bitbucket
- **Dark/Light theme** — toggle with persistent preference
- **i18n** — English & Farsi support
- **Responsive** — desktop, tablet, mobile; keyboard accessible

## 🚀 Quick Start

1. Open [repodest.github.io/repodest](https://mohsen-niksirat.github.io/repodest/)
2. Paste `owner/repo`, a GitHub URL, or a username
3. Explore the tabs; tick files in **Files** → generate your **Digest**

## 🛠️ Tech Stack

HTML5 · CSS3 · Vanilla JS · Chart.js · html2canvas · GitHub REST API · PWA · Zero build step

## 🧪 Running Tests

```bash
node tests.test.js
```

## 📄 License

MIT © [Mohsen Niksirat](https://github.com/mohsen-niksirat)

---

# 🇮🇷 فارسی

## ✨ رپودست چیست؟

رپودست یک **تحلیل‌گر سمت-کلاینت مخازن گیت‌هاب** و **سازنده خلاصه آماده LLM** است. هر آدرس گیت‌هابی را وارد کنید، امتیاز سلامت، تفکیک زبان‌ها، مرورگر فایل، بینش‌های کامیت و جوایز سرگرم‌کننده دریافت کنید — سپس فایل‌های انتخابی را در یک پرامپت آماده ChatGPT، Claude یا Gemini بسته‌بندی کنید.

> ۱۰۰٪ سمت کلاینت: بدون سرور، بدون ردیابی، بدون نیاز به کلید API.

### 🩺 امتیاز سلامت
۱۰ بررسی وزن‌دار (مجوز، README، تست‌ها، CI، مستندات، تازگی) در یک عدد صادقانه.

### 📊 تفکیک زبان‌ها
نمودار میله‌ای و دایره‌ای دقیق بر اساس بایت.

### 🤖 خلاصه LLM
فایل‌ها را در درخت انتخاب کنید → تولید → پرامپت قالب‌بندی شده با فراداده رپو، README، درخت فایل و محتوای کامل.

### 🗂️ مرورگر فایل
درخت با رندر تنبل، با اندازه‌ها و توزیع انواع فایل.

### 📈 فعالیت
نمودار کامیت ۵۲ هفته‌ای، مشارکت‌کنندگان برتر، کامیت‌های اخیر.

### 🏆 حالت سرگرمی
بیش از ۸ شخصیت رپو، حالت مسخره کردن، ۱۶ جایزه قابل باز کردن.

### ⚔️ حالت نبرد
مقایسه دو رپو در کنار هم با نمایش خودکار برنده.

### 📸 اشتراک‌گذاری
لینک‌های عمیق، کارت PNG، دکمه توییت، گزارش قابل چاپ A4.

### ⚙️ جزئیات عملی
- **کشینگ** — داده رپو تا ۶ ساعت در localStorage کش می‌شود
- **آگاه از محدودیت نرخ** — توکن اختیاری برای ۵,۰۰۰ درخواست/ساعت
- **چند پلتفرمی** — گیت‌هاب، گیت‌لاب، بیت‌باکت
- **تم تاریک/روشن** — با ترجیح پایدار
- **چند زبانه** — پشتیبانی انگلیسی و فارسی

### 🚀 شروع سریع

1. [repodest.github.io/repodest](https://mohsen-niksirat.github.io/repodest/) را باز کنید
2. `owner/repo`، آدرس گیت‌هاب، یا نام کاربری را وارد کنید
3. تب‌ها را کاوش کنید؛ فایل‌ها را در **فایل‌ها** تیک بزنید → **خلاصه** خود را تولید کنید

### 📄 مجوز

MIT © [محسن نیک‌سیرت](https://github.com/mohsen-niksirat)

---

# 🇪🇸 Español

## ✨ ¿Qué es Repodest?

Repodest es un **analizador de repositorios de GitHub** del lado del cliente y un **generador de resúmenes listos para LLM**. Pega cualquier URL de GitHub, obtén una puntuación de salud, desglose de idiomas, explorador de archivos, insights de commits y trofeos divertidos — luego empaqueta los archivos seleccionados en un prompt listo para ChatGPT, Claude o Gemini.

> 100% del lado del cliente: sin backend, sin rastreo, sin API key necesaria.

### 🩺 Puntuación de Salud
10 verificaciones ponderadas (licencia, README, tests, CI, docs, frescura) en un número honesto.

### 📊 Desglose de Idiomas
Gráfico de barras y dona preciso en bytes.

### 🤖 Resumen LLM
Selecciona archivos → Genera → obtén un prompt formateado con metadatos, README, árbol de archivos y contenido completo.

### 🗂️ Explorador de Archivos
Árbol con tamaños, distribución por tipo y archivos más pesados.

### 📈 Actividad
Gráfico de commits de 52 semanas, contribuidores principales, commits recientes.

### 🏆 Modo Divertido
8+ personalidades de repo, modo roast, 16 trofeos desbloqueables.

### ⚔️ Modo Batalla
Compara dos repos lado a lado con resaltado automático del ganador.

### 🚀 Inicio Rápido

1. Abre [repodest.github.io/repodest](https://mohsen-niksirat.github.io/repodest/)
2. Pega `owner/repo`, una URL de GitHub, o un nombre de usuario
3. Explora las pestañas; marca archivos en **Archivos** → genera tu **Resumen**

### 📄 Licencia

MIT © [Mohsen Niksirat](https://github.com/mohsen-niksirat)

---

# 🇨🇳 中文

## ✨ 什么是 Repodest？

Repodest 是一个**客户端 GitHub 仓库分析器**和 **LLM 就绪摘要生成器**。粘贴任何 GitHub URL，获取健康评分、语言分析、文件浏览器、提交洞察和趣味奖杯——然后将选中的文件打包成可以直接粘贴到 ChatGPT、Claude 或 Gemini 的提示词。

> 100% 客户端：无后端、无追踪、无需 API 密钥。

### 🩺 健康评分
10 项加权检查（许可证、README、测试、CI、文档、活跃度）浓缩为一个诚实的数字。

### 📊 语言分析
基于字节的精确条形图和甜甜圈图。

### 🤖 LLM 摘要
在树中选择文件 → 生成 → 获取格式化的提示词，包含仓库元数据、README、文件树和完整文件内容。

### 🗂️ 文件浏览器
懒加载渲染的树，包含大小、类型分布和最大的文件。

### 📈 活动
52 周提交图表、主要贡献者、最近提交。

### 🏆 趣味模式
8+ 仓库人格、吐槽模式、16 个可解锁奖杯。

### ⚔️ 对战模式
并排比较两个仓库，自动高亮显示获胜者。

### 🚀 快速开始

1. 打开 [repodest.github.io/repodest](https://mohsen-niksirat.github.io/repodest/)
2. 粘贴 `owner/repo`、GitHub URL 或用户名
3. 浏览标签页；在**文件**中勾选文件 → 生成你的**摘要**

### 📄 许可证

MIT © [Mohsen Niksirat](https://github.com/mohsen-niksirat)

---

# 🇫🇷 Français

## ✨ Qu'est-ce que Repodest ?

Repodest est un **analyseur de dépôts GitHub** côté client et un **générateur de résumés prêts pour LLM**. Collez n'importe quelle URL GitHub, obtenez un score de santé, une répartition des langages, un explorateur de fichiers, des insights de commits et des trophées amusants — puis emballez les fichiers sélectionnés dans un prompt prêt pour ChatGPT, Claude ou Gemini.

> 100% côté client : pas de backend, pas de tracking, pas de clé API nécessaire.

### 🩺 Score de Santé
10 vérifications pondérées (licence, README, tests, CI, docs, fraîcheur) en un nombre honnête.

### 📊 Répartition des Langages
Graphique à barres et donut précis en octets.

### 🤖 Résumé LLM
Sélectionnez des fichiers → Générez → obtenez un prompt formaté avec les métadonnées, le README, l'arborescence et le contenu complet.

### 🗂️ Explorateur de Fichiers
Arbre avec tailles, distribution par type et fichiers les plus lourds.

### 📈 Activité
Graphique de commits sur 52 semaines, contributeurs principaux, commits récents.

### 🏆 Mode Fun
8+ personnalités de dépôt, mode roast, 16 trophées débloquables.

### ⚔️ Mode Battle
Comparez deux dépôts côte à côte avec mise en évidence automatique du gagnant.

### 🚀 Démarrage Rapide

1. Ouvrez [repodest.github.io/repodest](https://mohsen-niksirat.github.io/repodest/)
2. Collez `owner/repo`, une URL GitHub ou un nom d'utilisateur
3. Explorez les onglets ; cochez des fichiers dans **Fichiers** → générez votre **Résumé**

### 📄 Licence

MIT © [Mohsen Niksirat](https://github.com/mohsen-niksirat)

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/mohsen-niksirat">Mohsen Niksirat</a><br>
  Inspired by <a href="https://gitingest.com">Gitingest</a> & GitHub Wrapped
</p>

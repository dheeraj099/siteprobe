# SiteProbe

Full-site performance and quality audit platform. Enter one URL, crawl the entire site, and get detailed reports across performance, accessibility, SEO, and security.

## Features

- **Full-site crawl** — discovers pages via links + sitemap.xml, respects robots.txt
- **Performance audit** — LCP, FCP, CLS, TBT, TTFB using Playwright + PerformanceObserver
- **Accessibility audit** — axe-core / WCAG 2.1 AA compliance
- **SEO audit** — title/description, headings, canonical, structured data
- **Security audit** — HSTS, CSP, X-Frame-Options, HTTPS, mixed content
- **Real-time progress** — Server-Sent Events stream during crawl/audit
- **SSRF protection** — blocks private IPs, cloud metadata endpoints
- **JSON export** — full audit data download

## Setup

```bash
# Install dependencies
npm run install:all

# Install Playwright browser
cd server && npx playwright install chromium

# Start server (port 3001)
npm run dev:server

# Start client (port 5173)
npm run dev:client
```

Open http://localhost:5173

## Stack

- **Server**: Node.js + Express + TypeScript + Playwright + better-sqlite3
- **Client**: Vite + React 19 + TypeScript + Tailwind CSS v4

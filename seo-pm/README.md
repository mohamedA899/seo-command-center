# SEO PM

A simple, self-hosted SEO project management system for personal use. Built on Node.js built-ins only — **zero npm dependencies, no build step, no install**. Single-user, no login, no external services. Your data stays in a local SQLite file.

## Features

- **My Sites** — manage the websites you're optimizing
- **Keyword tracker** — keyword, target URL, volume, search intent, position. Every position update is saved to a per-keyword history. Search and filter by site.
- **Task board** — Kanban with Backlog / In Progress / Review / Done, priority, due dates, task types (task, content, technical, outreach), drag & drop
- **Site audit** — per-site on-page/technical/content/off-page checklist, auto-seeded with an 18-item senior-SEO template, progress bar, custom items
- **Backlinks** — log source/target URLs, anchor text, dofollow/nofollow, status (live / pending / lost)
- **Dashboard** — portfolio stats: sites, tracked keywords, avg position, top 3 / top 10, open tasks, live dofollow links, upcoming deadlines

## Run

Requires **Node.js 22.13+** (for the built-in SQLite module). No `npm install` needed.

```bash
npm start
```

or equivalently:

```bash
node --experimental-sqlite --no-warnings server.js
```

Open http://localhost:3000 in your browser.

Check your version with `node --version`. If yours is older, update from [nodejs.org](https://nodejs.org/) — it's a 2-minute install and the app keeps working afterwards.

## Configuration

| Env var   | Default            | Description                     |
|-----------|--------------------|---------------------------------|
| `PORT`    | `3000`             | HTTP port                       |
| `DATA_DIR`| project directory  | Where `seo-pm.db` is stored     |

## Backup

All data lives in `seo-pm.db` (SQLite, WAL mode). Copy that file to back up. To start fresh, delete it and restart.

## API

REST API under `/api`: `projects`, `keywords` (+ `/history`), `tasks`, `audits`, `backlinks`, `dashboard`. GET lists, POST creates, PUT/PATCH updates, DELETE removes. Deleting a project cascades to its keywords, tasks, backlinks and audit items.

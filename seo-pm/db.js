const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'seo-pm.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  target_url TEXT DEFAULT '',
  volume INTEGER,
  intent TEXT DEFAULT 'informational',
  position INTEGER,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keyword_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'backlog',
  priority TEXT DEFAULT 'medium',
  due_date TEXT,
  type TEXT DEFAULT 'task',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS backlinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT DEFAULT '',
  anchor_text TEXT DEFAULT '',
  dofollow INTEGER DEFAULT 1,
  status TEXT DEFAULT 'live',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_project ON backlinks(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_items(project_id);
`);

const AUDIT_TEMPLATE = [
  { category: 'Technical', title: 'Fix crawl errors and broken links' },
  { category: 'Technical', title: 'Ensure HTTPS + single canonical host' },
  { category: 'Technical', title: 'Verify XML sitemap in Search Console' },
  { category: 'Technical', title: 'Check robots.txt rules' },
  { category: 'Technical', title: 'Fix Core Web Vitals (LCP, INP, CLS)' },
  { category: 'Technical', title: 'Add/update structured data (JSON-LD)' },
  { category: 'Technical', title: 'Fix redirect chains and orphan pages' },
  { category: 'On-page', title: 'Unique title tags for all key pages' },
  { category: 'On-page', title: 'Meta descriptions with CTA on key pages' },
  { category: 'On-page', title: 'One H1 per page, logical H2/H3 outline' },
  { category: 'On-page', title: 'Descriptive URLs and internal link structure' },
  { category: 'On-page', title: 'Image alt text and compressed images' },
  { category: 'Content', title: 'Content matches search intent per target page' },
  { category: 'Content', title: 'Keyword map: one primary keyword per page' },
  { category: 'Content', title: 'Refresh thin/outdated content' },
  { category: 'Content', title: 'Add FAQ / People-also-ask coverage' },
  { category: 'Off-page', title: 'Audit backlink profile for toxic links' },
  { category: 'Off-page', title: 'Identify 5+ new link opportunities' },
];

module.exports = { db, AUDIT_TEMPLATE };

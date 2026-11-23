const http = require('http');
const fs = require('fs');
const path = require('path');
const { db, AUDIT_TEMPLATE } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TASK_STATUSES = ['backlog', 'in-progress', 'review', 'done'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/* ---------- tiny router ---------- */

const routes = [];
const route = (method, pattern, fn) => {
  const keys = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$'
  );
  routes.push({ method, regex, keys, fn });
};

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    const match = routes.find((r) => r.method === req.method && r.regex.test(pathname));
    if (!match) return send(res, 404, { error: 'not found' });
    const m = pathname.match(match.regex);
    const params = {};
    match.keys.forEach((k, i) => { params[k] = m[i + 1]; });
    try {
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      match.fn({ res, params, query: url.searchParams, body });
    } catch (err) {
      send(res, 500, { error: err.message });
    }
    return;
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, index) => {
        if (err2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(index);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

/* ---------- projects (sites) ---------- */

route('GET', '/api/projects', ({ res }) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM keywords k WHERE k.project_id = p.id) AS keyword_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_tasks,
      (SELECT COUNT(*) FROM backlinks b WHERE b.project_id = p.id) AS backlink_count
    FROM projects p ORDER BY p.created_at DESC
  `).all();
  send(res, 200, rows);
});

route('POST', '/api/projects', ({ res, body }) => {
  const { name, domain, notes } = body;
  if (!name) return send(res, 400, { error: 'name is required' });
  const info = db.prepare(
    'INSERT INTO projects (name, domain, notes, created_at) VALUES (?, ?, ?, ?)'
  ).run(name, domain || '', notes || '', new Date().toISOString());
  const id = Number(info.lastInsertRowid);
  const seed = db.prepare(
    'INSERT INTO audit_items (project_id, category, title, done) VALUES (?, ?, ?, 0)'
  );
  db.exec('BEGIN');
  try {
    for (const item of AUDIT_TEMPLATE) seed.run(id, item.category, item.title);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  send(res, 201, db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

route('PUT', '/api/projects/:id', ({ res, params, body }) => {
  const { name, domain, notes } = body;
  db.prepare(
    'UPDATE projects SET name = COALESCE(?, name), domain = COALESCE(?, domain), notes = COALESCE(?, notes) WHERE id = ?'
  ).run(name ?? null, domain ?? null, notes ?? null, params.id);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(params.id);
  if (!row) return send(res, 404, { error: 'not found' });
  send(res, 200, row);
});

route('DELETE', '/api/projects/:id', ({ res, params }) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(params.id);
  send(res, 200, { ok: true });
});

/* ---------- keywords ---------- */

route('GET', '/api/keywords', ({ res, query }) => {
  const clauses = [];
  const args = [];
  if (query.get('project_id')) { clauses.push('k.project_id = ?'); args.push(query.get('project_id')); }
  if (query.get('q')) { clauses.push('k.keyword LIKE ?'); args.push(`%${query.get('q')}%`); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT k.*, p.name AS project_name FROM keywords k
    JOIN projects p ON p.id = k.project_id
    ${where} ORDER BY k.position IS NULL DESC, k.position ASC, k.keyword ASC
  `).all(...args);
  send(res, 200, rows);
});

route('POST', '/api/keywords', ({ res, body }) => {
  const { project_id, keyword, target_url, volume, intent, position, notes } = body;
  if (!project_id || !keyword) return send(res, 400, { error: 'project_id and keyword are required' });
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO keywords (project_id, keyword, target_url, volume, intent, position, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, keyword, target_url || '', volume || null, intent || 'informational',
         position || null, notes || '', now);
  const id = Number(info.lastInsertRowid);
  if (position) {
    db.prepare('INSERT INTO keyword_history (keyword_id, position, checked_at) VALUES (?, ?, ?)')
      .run(id, position, now);
  }
  send(res, 201, db.prepare('SELECT * FROM keywords WHERE id = ?').get(id));
});

route('PUT', '/api/keywords/:id', ({ res, params, body }) => {
  const { keyword, target_url, volume, intent, position, notes } = body;
  const existing = db.prepare('SELECT * FROM keywords WHERE id = ?').get(params.id);
  if (!existing) return send(res, 404, { error: 'not found' });
  db.prepare(`
    UPDATE keywords SET keyword = COALESCE(?, keyword), target_url = COALESCE(?, target_url),
      volume = COALESCE(?, volume), intent = COALESCE(?, intent), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(keyword ?? null, target_url ?? null, volume ?? null, intent ?? null, notes ?? null, params.id);
  if (position !== undefined && position !== null && position !== '') {
    const intPos = parseInt(position, 10);
    db.prepare('UPDATE keywords SET position = ? WHERE id = ?').run(intPos, params.id);
    if (intPos !== existing.position) {
      db.prepare('INSERT INTO keyword_history (keyword_id, position, checked_at) VALUES (?, ?, ?)')
        .run(params.id, intPos, new Date().toISOString());
    }
  }
  send(res, 200, db.prepare('SELECT * FROM keywords WHERE id = ?').get(params.id));
});

route('DELETE', '/api/keywords/:id', ({ res, params }) => {
  db.prepare('DELETE FROM keywords WHERE id = ?').run(params.id);
  send(res, 200, { ok: true });
});

route('GET', '/api/keywords/:id/history', ({ res, params }) => {
  send(res, 200, db.prepare(
    'SELECT position, checked_at FROM keyword_history WHERE keyword_id = ? ORDER BY checked_at ASC'
  ).all(params.id));
});

/* ---------- tasks ---------- */

route('GET', '/api/tasks', ({ res, query }) => {
  const clauses = [];
  const args = [];
  if (query.get('project_id')) { clauses.push('t.project_id = ?'); args.push(query.get('project_id')); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT t.*, p.name AS project_name FROM tasks t
    JOIN projects p ON p.id = t.project_id
    ${where}
    ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC
  `).all(...args);
  send(res, 200, rows);
});

route('POST', '/api/tasks', ({ res, body }) => {
  const { project_id, title, description, status, priority, due_date, type } = body;
  if (!project_id || !title) return send(res, 400, { error: 'project_id and title are required' });
  const info = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, title, description || '', TASK_STATUSES.includes(status) ? status : 'backlog',
         priority || 'medium', due_date || null, type || 'task');
  send(res, 201, db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

route('PUT', '/api/tasks/:id', ({ res, params, body }) => {
  const { title, description, status, priority, due_date, type } = body;
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(params.id);
  if (!t) return send(res, 404, { error: 'not found' });
  db.prepare(`
    UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description),
      status = COALESCE(?, status), priority = COALESCE(?, priority),
      due_date = COALESCE(?, due_date), type = COALESCE(?, type)
    WHERE id = ?
  `).run(title ?? null, description ?? null,
         TASK_STATUSES.includes(status) ? status : null,
         priority ?? null, due_date ?? null, type ?? null, params.id);
  send(res, 200, db.prepare('SELECT * FROM tasks WHERE id = ?').get(params.id));
});

route('DELETE', '/api/tasks/:id', ({ res, params }) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(params.id);
  send(res, 200, { ok: true });
});

/* ---------- audits ---------- */

route('GET', '/api/audits', ({ res, query }) => {
  let projectId = query.get('project_id');
  if (!projectId) {
    const first = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get();
    projectId = first ? first.id : null;
  }
  if (!projectId) return send(res, 200, { project_id: null, items: [] });
  send(res, 200, {
    project_id: Number(projectId),
    items: db.prepare(
      'SELECT * FROM audit_items WHERE project_id = ? ORDER BY category, id'
    ).all(projectId),
  });
});

route('PATCH', '/api/audits/:id', ({ res, params, body }) => {
  const { done, notes } = body;
  const item = db.prepare('SELECT * FROM audit_items WHERE id = ?').get(params.id);
  if (!item) return send(res, 404, { error: 'not found' });
  db.prepare('UPDATE audit_items SET done = COALESCE(?, done), notes = COALESCE(?, notes) WHERE id = ?')
    .run(done === undefined ? null : (done ? 1 : 0), notes ?? null, params.id);
  send(res, 200, db.prepare('SELECT * FROM audit_items WHERE id = ?').get(params.id));
});

route('POST', '/api/audits', ({ res, body }) => {
  const { project_id, category, title } = body;
  if (!project_id || !title) return send(res, 400, { error: 'project_id and title are required' });
  const info = db.prepare('INSERT INTO audit_items (project_id, category, title, done) VALUES (?, ?, ?, 0)')
    .run(project_id, category || 'General', title);
  send(res, 201, db.prepare('SELECT * FROM audit_items WHERE id = ?').get(info.lastInsertRowid));
});

route('DELETE', '/api/audits/:id', ({ res, params }) => {
  db.prepare('DELETE FROM audit_items WHERE id = ?').run(params.id);
  send(res, 200, { ok: true });
});

/* ---------- backlinks ---------- */

route('GET', '/api/backlinks', ({ res, query }) => {
  const clauses = [];
  const args = [];
  if (query.get('project_id')) { clauses.push('b.project_id = ?'); args.push(query.get('project_id')); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT b.*, p.name AS project_name FROM backlinks b
    JOIN projects p ON p.id = b.project_id
    ${where} ORDER BY b.created_at DESC
  `).all(...args);
  send(res, 200, rows);
});

route('POST', '/api/backlinks', ({ res, body }) => {
  const { project_id, source_url, target_url, anchor_text, dofollow, status, notes } = body;
  if (!project_id || !source_url) return send(res, 400, { error: 'project_id and source_url are required' });
  const info = db.prepare(`
    INSERT INTO backlinks (project_id, source_url, target_url, anchor_text, dofollow, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, source_url, target_url || '', anchor_text || '',
         dofollow === false ? 0 : 1, status || 'live', notes || '');
  send(res, 201, db.prepare('SELECT * FROM backlinks WHERE id = ?').get(info.lastInsertRowid));
});

route('PUT', '/api/backlinks/:id', ({ res, params, body }) => {
  const { source_url, target_url, anchor_text, dofollow, status, notes } = body;
  const b = db.prepare('SELECT * FROM backlinks WHERE id = ?').get(params.id);
  if (!b) return send(res, 404, { error: 'not found' });
  db.prepare(`
    UPDATE backlinks SET source_url = COALESCE(?, source_url), target_url = COALESCE(?, target_url),
      anchor_text = COALESCE(?, anchor_text), dofollow = COALESCE(?, dofollow),
      status = COALESCE(?, status), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(source_url ?? null, target_url ?? null, anchor_text ?? null,
         dofollow === undefined ? null : (dofollow ? 1 : 0), status ?? null, notes ?? null, params.id);
  send(res, 200, db.prepare('SELECT * FROM backlinks WHERE id = ?').get(params.id));
});

route('DELETE', '/api/backlinks/:id', ({ res, params }) => {
  db.prepare('DELETE FROM backlinks WHERE id = ?').run(params.id);
  send(res, 200, { ok: true });
});

/* ---------- dashboard ---------- */

route('GET', '/api/dashboard', ({ res }) => {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM projects) AS projects,
      (SELECT COUNT(*) FROM keywords) AS keywords,
      (SELECT AVG(position) FROM keywords WHERE position IS NOT NULL) AS avg_position,
      (SELECT COUNT(*) FROM keywords WHERE position BETWEEN 1 AND 3) AS top3,
      (SELECT COUNT(*) FROM keywords WHERE position BETWEEN 4 AND 10) AS top10,
      (SELECT COUNT(*) FROM tasks WHERE status != 'done') AS open_tasks,
      (SELECT COUNT(*) FROM tasks WHERE status = 'done') AS done_tasks,
      (SELECT COUNT(*) FROM backlinks WHERE status = 'live' AND dofollow = 1) AS live_dofollow_links,
      (SELECT COUNT(*) FROM audit_items WHERE done = 0) AS open_audit_items
  `).get();
  stats.avg_position = stats.avg_position ? Math.round(Number(stats.avg_position) * 10) / 10 : null;
  const stat = (k) => Number(stats[k] ?? 0);
  send(res, 200, {
    stats: {
      projects: stat('projects'), keywords: stat('keywords'), avg_position: stats.avg_position,
      top3: stat('top3'), top10: stat('top10'), open_tasks: stat('open_tasks'),
      done_tasks: stat('done_tasks'), live_dofollow_links: stat('live_dofollow_links'),
      open_audit_items: stat('open_audit_items'),
    },
    upcoming: db.prepare(`
      SELECT t.*, p.name AS project_name FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.status != 'done' AND t.due_date IS NOT NULL
      ORDER BY t.due_date ASC LIMIT 8
    `).all(),
  });
});

server.listen(PORT, () => {
  console.log(`SEO PM running at http://localhost:${PORT}`);
});

const express = require('express');
const path = require('path');
const { db, AUDIT_TEMPLATE } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- helpers ---------- */

const wrap = (fn) => (req, res) => {
  try {
    fn(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------- projects (sites) ---------- */

app.get('/api/projects', wrap((req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM keywords k WHERE k.project_id = p.id) AS keyword_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_tasks,
      (SELECT COUNT(*) FROM backlinks b WHERE b.project_id = p.id) AS backlink_count
    FROM projects p ORDER BY p.created_at DESC
  `).all();
  res.json(rows);
}));

app.post('/api/projects', wrap((req, res) => {
  const { name, domain, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const now = new Date().toISOString();
  const info = db.prepare(
    'INSERT INTO projects (name, domain, notes, created_at) VALUES (?, ?, ?, ?)'
  ).run(name, domain || '', notes || '', now);
  const id = info.lastInsertRowid;
  const seed = db.prepare(
    'INSERT INTO audit_items (project_id, category, title, done) VALUES (?, ?, ?, 0)'
  );
  const insertAll = db.transaction(() => {
    for (const item of AUDIT_TEMPLATE) seed.run(id, item.category, item.title);
  });
  insertAll();
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
}));

app.put('/api/projects/:id', wrap((req, res) => {
  const { name, domain, notes } = req.body;
  db.prepare(
    'UPDATE projects SET name = COALESCE(?, name), domain = COALESCE(?, domain), notes = COALESCE(?, notes) WHERE id = ?'
  ).run(name ?? null, domain ?? null, notes ?? null, req.params.id);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
}));

app.delete('/api/projects/:id', wrap((req, res) => {
  db.prepare('PRAGMA foreign_keys = ON').run();
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

/* ---------- keywords ---------- */

app.get('/api/keywords', wrap((req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.project_id) { clauses.push('k.project_id = ?'); params.push(req.query.project_id); }
  if (req.query.q) { clauses.push('k.keyword LIKE ?'); params.push(`%${req.query.q}%`); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT k.*, p.name AS project_name FROM keywords k
    JOIN projects p ON p.id = k.project_id
    ${where} ORDER BY k.position IS NULL DESC, k.position ASC, k.keyword ASC
  `).all(...params);
  res.json(rows);
}));

app.post('/api/keywords', wrap((req, res) => {
  const { project_id, keyword, target_url, volume, intent, position, notes } = req.body;
  if (!project_id || !keyword) return res.status(400).json({ error: 'project_id and keyword are required' });
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO keywords (project_id, keyword, target_url, volume, intent, position, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, keyword, target_url || '', volume || null, intent || 'informational',
         position || null, notes || '', now);
  if (position) {
    db.prepare('INSERT INTO keyword_history (keyword_id, position, checked_at) VALUES (?, ?, ?)')
      .run(info.lastInsertRowid, position, now);
  }
  res.status(201).json(db.prepare('SELECT * FROM keywords WHERE id = ?').get(info.lastInsertRowid));
}));

app.put('/api/keywords/:id', wrap((req, res) => {
  const { keyword, target_url, volume, intent, position, notes } = req.body;
  const existing = db.prepare('SELECT * FROM keywords WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare(`
    UPDATE keywords SET keyword = COALESCE(?, keyword), target_url = COALESCE(?, target_url),
      volume = COALESCE(?, volume), intent = COALESCE(?, intent), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(keyword ?? null, target_url ?? null, volume ?? null, intent ?? null, notes ?? null, req.params.id);
  if (position !== undefined && position !== null && position !== '') {
    const intPos = parseInt(position, 10);
    db.prepare('UPDATE keywords SET position = ? WHERE id = ?').run(intPos, req.params.id);
    if (intPos !== existing.position) {
      db.prepare('INSERT INTO keyword_history (keyword_id, position, checked_at) VALUES (?, ?, ?)')
        .run(req.params.id, intPos, new Date().toISOString());
    }
  }
  res.json(db.prepare('SELECT * FROM keywords WHERE id = ?').get(req.params.id));
}));

app.delete('/api/keywords/:id', wrap((req, res) => {
  db.prepare('DELETE FROM keywords WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/keywords/:id/history', wrap((req, res) => {
  const rows = db.prepare(
    'SELECT position, checked_at FROM keyword_history WHERE keyword_id = ? ORDER BY checked_at ASC'
  ).all(req.params.id);
  res.json(rows);
}));

/* ---------- tasks ---------- */

const TASK_STATUSES = ['backlog', 'in-progress', 'review', 'done'];

app.get('/api/tasks', wrap((req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.project_id) { clauses.push('t.project_id = ?'); params.push(req.query.project_id); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT t.*, p.name AS project_name FROM tasks t
    JOIN projects p ON p.id = t.project_id
    ${where}
    ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC
  `).all(...params);
  res.json(rows);
}));

app.post('/api/tasks', wrap((req, res) => {
  const { project_id, title, description, status, priority, due_date, type } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });
  const info = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, due_date, type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, title, description || '', TASK_STATUSES.includes(status) ? status : 'backlog',
         priority || 'medium', due_date || null, type || 'task');
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
}));

app.put('/api/tasks/:id', wrap((req, res) => {
  const { title, description, status, priority, due_date, type } = req.body;
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  db.prepare(`
    UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description),
      status = COALESCE(?, status), priority = COALESCE(?, priority),
      due_date = COALESCE(?, due_date), type = COALESCE(?, type)
    WHERE id = ?
  `).run(title ?? null, description ?? null,
         TASK_STATUSES.includes(status) ? status : null,
         priority ?? null, due_date ?? null, type ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
}));

app.delete('/api/tasks/:id', wrap((req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

/* ---------- audits ---------- */

app.get('/api/audits', wrap((req, res) => {
  let projectId = req.query.project_id;
  if (!projectId) {
    const first = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get();
    projectId = first ? first.id : null;
  }
  if (!projectId) return res.json({ project_id: null, items: [] });
  const items = db.prepare(
    'SELECT * FROM audit_items WHERE project_id = ? ORDER BY category, id'
  ).all(projectId);
  res.json({ project_id: Number(projectId), items });
}));

app.patch('/api/audits/:id', wrap((req, res) => {
  const { done, notes } = req.body;
  const item = db.prepare('SELECT * FROM audit_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE audit_items SET done = COALESCE(?, done), notes = COALESCE(?, notes) WHERE id = ?')
    .run(done === undefined ? null : (done ? 1 : 0), notes ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM audit_items WHERE id = ?').get(req.params.id));
}));

app.post('/api/audits', wrap((req, res) => {
  const { project_id, category, title } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });
  const info = db.prepare('INSERT INTO audit_items (project_id, category, title, done) VALUES (?, ?, ?, 0)')
    .run(project_id, category || 'General', title);
  res.status(201).json(db.prepare('SELECT * FROM audit_items WHERE id = ?').get(info.lastInsertRowid));
}));

app.delete('/api/audits/:id', wrap((req, res) => {
  db.prepare('DELETE FROM audit_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

/* ---------- backlinks ---------- */

app.get('/api/backlinks', wrap((req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.project_id) { clauses.push('b.project_id = ?'); params.push(req.query.project_id); }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT b.*, p.name AS project_name FROM backlinks b
    JOIN projects p ON p.id = b.project_id
    ${where} ORDER BY b.created_at DESC
  `).all(...params);
  res.json(rows);
}));

app.post('/api/backlinks', wrap((req, res) => {
  const { project_id, source_url, target_url, anchor_text, dofollow, status, notes } = req.body;
  if (!project_id || !source_url) return res.status(400).json({ error: 'project_id and source_url are required' });
  const info = db.prepare(`
    INSERT INTO backlinks (project_id, source_url, target_url, anchor_text, dofollow, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, source_url, target_url || '', anchor_text || '',
         dofollow === false ? 0 : 1, status || 'live', notes || '');
  res.status(201).json(db.prepare('SELECT * FROM backlinks WHERE id = ?').get(info.lastInsertRowid));
}));

app.put('/api/backlinks/:id', wrap((req, res) => {
  const { source_url, target_url, anchor_text, dofollow, status, notes } = req.body;
  const b = db.prepare('SELECT * FROM backlinks WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'not found' });
  db.prepare(`
    UPDATE backlinks SET source_url = COALESCE(?, source_url), target_url = COALESCE(?, target_url),
      anchor_text = COALESCE(?, anchor_text), dofollow = COALESCE(?, dofollow),
      status = COALESCE(?, status), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(source_url ?? null, target_url ?? null, anchor_text ?? null,
         dofollow === undefined ? null : (dofollow ? 1 : 0), status ?? null, notes ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM backlinks WHERE id = ?').get(req.params.id));
}));

app.delete('/api/backlinks/:id', wrap((req, res) => {
  db.prepare('DELETE FROM backlinks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

/* ---------- dashboard ---------- */

app.get('/api/dashboard', wrap((req, res) => {
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
  stats.avg_position = stats.avg_position ? Math.round(stats.avg_position * 10) / 10 : null;
  const upcoming = db.prepare(`
    SELECT t.*, p.name AS project_name FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.status != 'done' AND t.due_date IS NOT NULL
    ORDER BY t.due_date ASC LIMIT 8
  `).all();
  res.json({ stats, upcoming });
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SEO PM running at http://localhost:${PORT}`);
});

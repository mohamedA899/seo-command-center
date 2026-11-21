/* SEO PM — frontend SPA */

const state = {
  view: 'dashboard',
  projectId: null,
  projects: [],
  search: '',
};

const main = document.getElementById('main');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

/* ---------- api ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- shell ---------- */
function renderNav() {
  const views = [
    ['dashboard', '📊 Dashboard'],
    ['keywords', '🎯 Keywords'],
    ['tasks', '📋 Task Board'],
    ['audit', '✅ Site Audit'],
    ['backlinks', '🔗 Backlinks'],
    ['projects', '🌐 My Sites'],
  ];
  document.getElementById('nav').innerHTML = views
    .map(([id, label]) => `<a class="nav-link ${state.view === id ? 'active' : ''}" data-view="${id}">${label}</a>`)
    .join('');
  document.querySelectorAll('#nav .nav-link').forEach((el) =>
    el.addEventListener('click', () => go(el.dataset.view)));

  document.getElementById('sidebar-projects').innerHTML = state.projects.map((p) => `
    <a class="project-link ${state.projectId === p.id ? 'active' : ''}" data-id="${p.id}">
      <span class="dot"></span>${esc(p.name)}
    </a>`).join('');
  document.querySelectorAll('#sidebar-projects .project-link').forEach((el) =>
    el.addEventListener('click', () => { state.projectId = Number(el.dataset.id); render(); }));
}

function go(view) {
  state.view = view;
  render();
}

/* ---------- modal ---------- */
function openModal(html) {
  modalBody.innerHTML = html;
  modal.showModal();
}
function closeModal() { modal.close(); }

function formProject(p) {
  openModal(`
    <h3>${p ? 'Edit Site' : 'New Site'}</h3>
    <p class="modal-sub">A project is a website you're optimizing. An audit checklist is created automatically.</p>
    <label>Site name</label><input id="f-name" value="${esc(p?.name || '')}" placeholder="e.g. My SaaS Blog">
    <label>Domain</label><input id="f-domain" value="${esc(p?.domain || '')}" placeholder="example.com">
    <label>Notes</label><textarea id="f-notes" rows="3">${esc(p?.notes || '')}</textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);
  document.getElementById('f-save').onclick = async () => {
    const body = {
      name: document.getElementById('f-name').value.trim(),
      domain: document.getElementById('f-domain').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
    };
    if (!body.name) return alert('Name is required');
    if (p) await api(`/api/projects/${p.id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/projects', { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    state.projectId = p ? state.projectId : null;
    await loadProjects();
    render();
  };
}

function formKeyword(k, projects) {
  openModal(`
    <h3>${k ? 'Edit Keyword' : 'Track New Keyword'}</h3>
    <p class="modal-sub">Update the position every time you check rank — history is kept per keyword.</p>
    <label>Site</label>
    <select id="f-project">${projects.map((p) =>
      `<option value="${p.id}" ${k?.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <label>Keyword</label><input id="f-keyword" value="${esc(k?.keyword || '')}" placeholder="e.g. best crm for startups">
    <div class="form-row">
      <div><label>Target URL</label><input id="f-url" value="${esc(k?.target_url || '')}" placeholder="/blog/best-crm"></div>
      <div><label>Monthly volume</label><input id="f-volume" type="number" value="${k?.volume ?? ''}" placeholder="1200"></div>
    </div>
    <div class="form-row">
      <div><label>Search intent</label>
        <select id="f-intent">
          ${['informational', 'commercial', 'transactional', 'navigational'].map((i) =>
            `<option ${k?.intent === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select></div>
      <div><label>Current position</label><input id="f-position" type="number" value="${k?.position ?? ''}" placeholder="e.g. 14"></div>
    </div>
    <label>Notes</label><textarea id="f-notes" rows="2">${esc(k?.notes || '')}</textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);
  document.getElementById('f-save').onclick = async () => {
    const body = {
      project_id: Number(document.getElementById('f-project').value),
      keyword: document.getElementById('f-keyword').value.trim(),
      target_url: document.getElementById('f-url').value.trim(),
      volume: document.getElementById('f-volume').value,
      intent: document.getElementById('f-intent').value,
      position: document.getElementById('f-position').value,
      notes: document.getElementById('f-notes').value.trim(),
    };
    if (!body.keyword) return alert('Keyword is required');
    if (k) await api(`/api/keywords/${k.id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/keywords', { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    state.projectId = Number(body.project_id);
    render();
  };
}

function formTask(t, projects) {
  openModal(`
    <h3>${t ? 'Edit Task' : 'New Task'}</h3>
    <label>Site</label>
    <select id="f-project">${projects.map((p) =>
      `<option value="${p.id}" ${t?.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <label>Title</label><input id="f-title" value="${esc(t?.title || '')}" placeholder="e.g. Write brief for homepage rewrite">
    <label>Description</label><textarea id="f-desc" rows="2">${esc(t?.description || '')}</textarea>
    <div class="form-row">
      <div><label>Priority</label>
        <select id="f-priority">${['high', 'medium', 'low'].map((p) =>
          `<option ${t?.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div><label>Due date</label><input id="f-due" type="date" value="${t?.due_date || ''}"></div>
    </div>
    <div class="form-row">
      <div><label>Type</label>
        <select id="f-type">${['task', 'content', 'technical', 'outreach'].map((x) =>
          `<option ${t?.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div><label>Status</label>
        <select id="f-status">${['backlog', 'in-progress', 'review', 'done'].map((s) =>
          `<option ${t?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);
  document.getElementById('f-save').onclick = async () => {
    const body = {
      project_id: Number(document.getElementById('f-project').value),
      title: document.getElementById('f-title').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      priority: document.getElementById('f-priority').value,
      due_date: document.getElementById('f-due').value || null,
      type: document.getElementById('f-type').value,
      status: document.getElementById('f-status').value,
    };
    if (!body.title) return alert('Title is required');
    if (t) await api(`/api/tasks/${t.id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/tasks', { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    render();
  };
}

function formBacklink(b, projects) {
  openModal(`
    <h3>${b ? 'Edit Backlink' : 'Log New Backlink'}</h3>
    <label>Site</label>
    <select id="f-project">${projects.map((p) =>
      `<option value="${p.id}" ${b?.project_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <label>Source URL (where the link is placed)</label><input id="f-source" value="${esc(b?.source_url || '')}" placeholder="https://partner-site.com/article">
    <label>Target URL (your page)</label><input id="f-target" value="${esc(b?.target_url || '')}" placeholder="https://example.com/page">
    <div class="form-row">
      <div><label>Anchor text</label><input id="f-anchor" value="${esc(b?.anchor_text || '')}"></div>
      <div><label>Status</label>
        <select id="f-status">${['live', 'pending', 'lost'].map((s) =>
          `<option ${b?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div><label>Link type</label>
        <select id="f-dofollow"><option value="1" ${b?.dofollow !== 0 ? 'selected' : ''}>dofollow</option>
          <option value="0" ${b?.dofollow === 0 ? 'selected' : ''}>nofollow</option></select></div>
      <div><label>Notes</label><input id="f-notes" value="${esc(b?.notes || '')}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" id="f-save">Save</button>
    </div>`);
  document.getElementById('f-save').onclick = async () => {
    const body = {
      project_id: Number(document.getElementById('f-project').value),
      source_url: document.getElementById('f-source').value.trim(),
      target_url: document.getElementById('f-target').value.trim(),
      anchor_text: document.getElementById('f-anchor').value.trim(),
      dofollow: document.getElementById('f-dofollow').value === '1',
      status: document.getElementById('f-status').value,
      notes: document.getElementById('f-notes').value.trim(),
    };
    if (!body.source_url) return alert('Source URL is required');
    if (b) await api(`/api/backlinks/${b.id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/backlinks', { method: 'POST', body: JSON.stringify(body) });
    closeModal();
    state.projectId = Number(body.project_id);
    render();
  };
}

/* ---------- views ---------- */

async function viewDashboard() {
  const { stats, upcoming } = await api('/api/dashboard');
  const stat = (label, value, sub = '') =>
    `<div class="card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`;
  const dueBadge = (d) => {
    if (!d) return '';
    const overdue = d < new Date().toISOString().slice(0, 10);
    return `<span class="due ${overdue ? 'overdue' : ''}">${overdue ? '⚠ overdue' : ''} ${d}</span>`;
  };
  return `
    <div class="page-head"><div><h2>Dashboard</h2><div class="subtitle">Portfolio overview across all your sites</div></div></div>
    ${state.projects.length === 0 ? `
      <div class="empty">Welcome! Add your first website to start tracking keywords, tasks, audits and backlinks.<br><br>
        <button class="btn" onclick="formProject()">+ Add your first site</button></div>` : `
    <div class="cards">
      ${stat('Sites', stats.projects)}
      ${stat('Tracked keywords', stats.keywords, stats.avg_position ? `avg position ${stats.avg_position}` : '')}
      ${stat('Top 3', stats.top3, `${stats.top10} in top 10`)}
      ${stat('Open tasks', stats.open_tasks, `${stats.done_tasks} done`)}
      ${stat('Live dofollow links', stats.live_dofollow_links)}
      ${stat('Audit items open', stats.open_audit_items)}
    </div>
    <div class="panel">
      <h3>⏰ Upcoming deadlines</h3>
      ${upcoming.length === 0 ? '<div class="muted">No scheduled tasks. Good pace.</div>' : `
      <div class="table-wrap"><table><thead><tr><th>Task</th><th>Site</th><th>Priority</th><th>Due</th></tr></thead><tbody>
      ${upcoming.map((t) => `<tr>
        <td><strong>${esc(t.title)}</strong></td><td class="muted">${esc(t.project_name)}</td>
        <td><span class="badge pr-${t.priority}">${t.priority}</span></td>
        <td>${dueBadge(t.due_date)}</td></tr>`).join('')}
      </tbody></table></div>`}
    </div>`}
  `;
}

async function viewKeywords() {
  if (state.projects.length === 0) return viewDashboard();
  const params = new URLSearchParams();
  if (state.projectId) params.set('project_id', state.projectId);
  if (state.search) params.set('q', state.search);
  const rows = await api('/api/keywords?' + params.toString());
  const posBadge = (p) => p == null ? '<span class="badge pos-none">not checked</span>'
    : `<span class="badge ${p <= 3 ? 'pos-1' : p <= 10 ? 'pos-2' : 'pos-3'}">#${p}</span>`;
  return `
    <div class="page-head">
      <div><h2>Keywords</h2><div class="subtitle">${rows.length} tracked${state.projectId ? ` · ${esc(state.projects.find((p) => p.id === state.projectId)?.name)}` : ' · all sites'}</div></div>
      <div class="head-actions">
        <button class="btn" onclick="formKeyword(null, state.projects)">+ Track keyword</button>
      </div>
    </div>
    <div class="toolbar">
      <input id="kw-search" placeholder="Search keywords…" value="${esc(state.search)}">
      <select id="kw-project">${'<option value="">All sites</option>' + state.projects.map((p) =>
        `<option value="${p.id}" ${state.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    </div>
    ${rows.length === 0 ? '<div class="empty">No keywords tracked yet.</div>' : `
    <div class="table-wrap"><table>
      <thead><tr><th>Keyword</th><th>Site</th><th>Target URL</th><th>Vol</th><th>Intent</th><th>Position</th><th></th></tr></thead>
      <tbody>${rows.map((k) => `<tr>
        <td><strong>${esc(k.keyword)}</strong>${k.notes ? `<div class="muted mono">${esc(k.notes)}</div>` : ''}</td>
        <td class="muted">${esc(k.project_name)}</td>
        <td class="mono">${k.target_url ? esc(k.target_url) : '—'}</td>
        <td class="muted">${k.volume ?? '—'}</td>
        <td><span class="badge intent">${esc(k.intent)}</span></td>
        <td ondblclick="quickPosition(${k.id}, ${k.position ?? 'null'})" title="Double-click to update position">${posBadge(k.position)}</td>
        <td><button class="icon-btn" title="Update position" onclick="quickPosition(${k.id}, ${k.position ?? 'null'})">↻</button>
            <button class="icon-btn" title="Edit" onclick="editKeyword(${k.id})">✎</button>
            <button class="icon-btn" title="Delete" onclick="del('keywords', ${k.id})">✕</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`}`;
}

async function viewTasks() {
  if (state.projects.length === 0) return viewDashboard();
  const params = state.projectId ? `?project_id=${state.projectId}` : '';
  const rows = await api('/api/tasks' + params);
  const cols = [
    ['backlog', 'Backlog'], ['in-progress', 'In Progress'], ['review', 'Review'], ['done', 'Done'],
  ];
  const today = new Date().toISOString().slice(0, 10);
  const taskCard = (t) => `
    <div class="task-item" draggable="true" data-id="${t.id}">
      <div class="project-name">${esc(t.project_name)} · ${esc(t.type)}</div>
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">
        <span class="badge pr-${t.priority}">${t.priority}</span>
        ${t.due_date ? `<span class="due ${t.due_date < today && t.status !== 'done' ? 'overdue' : ''}">${t.due_date}</span>` : ''}
        <span style="flex:1"></span>
        <button class="icon-btn" onclick="editTask(${t.id})">✎</button>
        <button class="icon-btn" onclick="del('tasks', ${t.id})">✕</button>
      </div>
    </div>`;
  return `
    <div class="page-head">
      <div><h2>Task Board</h2><div class="subtitle">Drag cards between columns to update status</div></div>
      <div class="head-actions"><button class="btn" onclick="formTask(null, state.projects)">+ New task</button></div>
    </div>
    <div class="kanban">
      ${cols.map(([status, label]) => {
        const items = rows.filter((t) => t.status === status);
        return `<div class="kanban-col" data-status="${status}">
          <h4>${label} <span class="muted">${items.length}</span></h4>
          ${items.map(taskCard).join('') || '<div class="muted mono" style="padding:8px 2px">empty</div>'}
        </div>`;
      }).join('')}
    </div>`;
}

async function viewAudit() {
  if (state.projects.length === 0) return viewDashboard();
  const params = state.projectId ? `?project_id=${state.projectId}` : '';
  const { project_id, items } = await api('/api/audits' + params);
  if (!project_id) return '<div class="empty">No site selected.</div>';
  const project = state.projects.find((p) => p.id === project_id);
  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const byCat = {};
  for (const item of items) (byCat[item.category] = byCat[item.category] || []).push(item);
  return `
    <div class="page-head">
      <div><h2>Site Audit — ${esc(project?.name || '')}</h2><div class="subtitle">On-page & technical checklist for this site</div></div>
      <div class="head-actions">
        <button class="btn" onclick="formAuditItem(${project_id})">+ Add checklist item</button>
      </div>
    </div>
    <div class="audit-progress">
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <span class="muted">${doneCount}/${items.length} done (${pct}%)</span>
    </div>
    ${items.length === 0 ? '<div class="empty">Checklist is empty for this site.</div>' : ''}
    ${Object.entries(byCat).map(([cat, catItems]) => `
      <div class="audit-group"><h3>${esc(cat)}</h3>
        ${catItems.map((i) => `
          <div class="audit-item ${i.done ? 'done' : ''}">
            <input type="checkbox" ${i.done ? 'checked' : ''} onchange="toggleAudit(${i.id}, this.checked)">
            <div class="audit-title">${esc(i.title)}
              ${i.notes ? `<div class="audit-notes">${esc(i.notes)}</div>` : ''}
            </div>
            <button class="icon-btn" onclick="del('audits', ${i.id})">✕</button>
          </div>`).join('')}
      </div>`).join('')}`;
}

async function viewBacklinks() {
  if (state.projects.length === 0) return viewDashboard();
  const params = state.projectId ? `?project_id=${state.projectId}` : '';
  const rows = await api('/api/backlinks' + params);
  const shortUrl = (u) => u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42);
  return `
    <div class="page-head">
      <div><h2>Backlinks</h2><div class="subtitle">${rows.length} links logged${state.projectId ? ` · ${esc(state.projects.find((p) => p.id === state.projectId)?.name)}` : ''}</div></div>
      <div class="head-actions"><button class="btn" onclick="formBacklink(null, state.projects)">+ Log backlink</button></div>
    </div>
    ${rows.length === 0 ? '<div class="empty">No backlinks logged yet. Add links you have built or acquired.</div>' : `
    <div class="table-wrap"><table>
      <thead><tr><th>Source</th><th>Target</th><th>Anchor</th><th>Site</th><th>Type</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map((b) => `<tr>
        <td class="mono"><a href="${esc(b.source_url)}" target="_blank" rel="noopener">${esc(shortUrl(b.source_url))}</a></td>
        <td class="mono muted">${b.target_url ? `<a href="${esc(b.target_url)}" target="_blank" rel="noopener">${esc(shortUrl(b.target_url))}</a>` : '—'}</td>
        <td>${esc(b.anchor_text) || '—'}</td>
        <td class="muted">${esc(b.project_name)}</td>
        <td><span class="badge ${b.dofollow ? 'dofollow' : 'nofollow'}">${b.dofollow ? 'dofollow' : 'nofollow'}</span></td>
        <td><span class="badge status-${esc(b.status)}">${esc(b.status)}</span></td>
        <td><button class="icon-btn" onclick="editBacklink(${b.id})">✎</button>
            <button class="icon-btn" onclick="del('backlinks', ${b.id})">✕</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`}`;
}

async function viewProjects() {
  const rows = state.projects;
  return `
    <div class="page-head">
      <div><h2>My Sites</h2><div class="subtitle">All websites you're managing</div></div>
      <div class="head-actions"><button class="btn" onclick="formProject()">+ New site</button></div>
    </div>
    ${rows.length === 0 ? '<div class="empty">No sites yet.</div>' : `
    <div class="table-wrap"><table>
      <thead><tr><th>Site</th><th>Domain</th><th>Keywords</th><th>Open tasks</th><th>Backlinks</th><th>Notes</th><th></th></tr></thead>
      <tbody>${rows.map((p) => `<tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td class="mono">${p.domain ? `<a href="https://${esc(p.domain)}" target="_blank" rel="noopener">${esc(p.domain)}</a>` : '—'}</td>
        <td class="muted">${p.keyword_count}</td>
        <td class="muted">${p.open_tasks}</td>
        <td class="muted">${p.backlink_count}</td>
        <td class="muted">${esc(p.notes)}</td>
        <td><button class="icon-btn" onclick="editProject(${p.id})">✎</button>
            <button class="icon-btn" onclick="del('projects', ${p.id}, true)">✕</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`}`;
}

/* ---------- interactions ---------- */

function editKeyword(id) {
  api('/api/keywords').then((rows) => {
    const k = rows.find((x) => x.id === id);
    if (k) formKeyword(k, state.projects);
  });
}

function editProject(id) {
  const p = state.projects.find((x) => x.id === id);
  if (p) formProject(p);
}

function editTask(id) {
  Promise.all([api('/api/tasks'), api('/api/projects')]).then(([rows]) => {
    const t = rows.find((x) => x.id === id);
    if (t) formTask(t, state.projects);
  });
}

function editBacklink(id) {
  api('/api/backlinks').then((rows) => {
    const b = rows.find((x) => x.id === id);
    if (b) formBacklink(b, state.projects);
  });
}

async function del(resource, id, confirmCascade = false) {
  if (confirmCascade && !confirm('Delete this site and ALL its keywords, tasks, backlinks and audit items?')) return;
  if (!confirmCascade && !confirm('Delete this item?')) return;
  await api(`/api/${resource}/${id}`, { method: 'DELETE' });
  if (resource === 'projects') {
    state.projectId = null;
    await loadProjects();
  }
  render();
}

let pendingPositionKeyword = null;
function quickPosition(id, current) {
  openModal(`
    <h3>Update position</h3>
    <label>Google position (leave empty to clear)</label>
    <input id="f-new-pos" type="number" value="${current ?? ''}" placeholder="e.g. 8">
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" id="f-save-pos">Save</button>
    </div>`);
  document.getElementById('f-save-pos').onclick = async () => {
    const val = document.getElementById('f-new-pos').value;
    await api(`/api/keywords/${id}`, { method: 'PUT', body: JSON.stringify({ position: val }) });
    closeModal();
    loadProjects();
    render();
  };
}

function formAuditItem(projectId) {
  openModal(`
    <h3>Add checklist item</h3>
    <div class="form-row">
      <div><label>Category</label><input id="f-cat" placeholder="e.g. Content"></div>
      <div><label>Title</label><input id="f-title" placeholder="e.g. Fix duplicate H1s"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" id="f-save-audit">Save</button>
    </div>`);
  document.getElementById('f-save-audit').onclick = async () => {
    const title = document.getElementById('f-title').value.trim();
    if (!title) return alert('Title is required');
    await api('/api/audits', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, category: document.getElementById('f-cat').value.trim() || 'General', title }),
    });
    closeModal();
    render();
  };
}

async function toggleAudit(id, done) {
  await api(`/api/audits/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) });
  render();
}

/* ---------- kanban drag & drop ---------- */

function setupKanban() {
  let draggedId = null;
  main.querySelectorAll('.task-item').forEach((el) => {
    el.addEventListener('dragstart', (e) => { draggedId = Number(el.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
  });
  main.querySelectorAll('.kanban-col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave', () => col.classList.remove('dragover'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('dragover');
      if (!draggedId) return;
      await api(`/api/tasks/${draggedId}`, { method: 'PUT', body: JSON.stringify({ status: col.dataset.status }) });
      draggedId = null;
      render();
    });
  });
}

/* ---------- render loop ---------- */

const views = { dashboard: viewDashboard, keywords: viewKeywords, tasks: viewTasks, audit: viewAudit, backlinks: viewBacklinks, projects: viewProjects };

async function loadProjects() {
  state.projects = await api('/api/projects');
  if (state.projectId && !state.projects.find((p) => p.id === state.projectId)) state.projectId = null;
}

async function render() {
  renderNav();
  try {
    main.innerHTML = await views[state.view]();
  } catch (err) {
    main.innerHTML = `<div class="empty">⚠ ${esc(err.message)} — is the server running?</div>`;
    return;
  }
  const search = main.querySelector('#kw-search');
  if (search) {
    search.addEventListener('input', () => {
      state.search = search.value;
      clearTimeout(render._t);
      render._t = setTimeout(render, 300);
      const end = search.value.length;
      search.focus();
      search.setSelectionRange(end, end);
    });
    search.focus();
    const end = search.value.length;
    search.setSelectionRange(end, end);
  }
  const projSel = main.querySelector('#kw-project');
  if (projSel) projSel.addEventListener('change', () => {
    state.projectId = projSel.value ? Number(projSel.value) : null;
    render();
  });
  if (state.view === 'tasks') setupKanban();
}

document.getElementById('btn-new-project').addEventListener('click', () => formProject());

loadProjects().then(render);

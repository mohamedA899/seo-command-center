
// Additional render functions for advanced features

function renderAdvancedAnalytics(container) {
  const stats = analytics.stats();
  container.innerHTML = `<div class="section-content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <div><h2 style="font-size:1.5rem;font-weight:800;margin-bottom:4px">Advanced Analytics</h2><p style="color:var(--text-muted);font-size:0.875rem">Performance metrics and productivity insights</p></div>
      <button class="btn btn-secondary" onclick="exportData('json')"><i class="fas fa-download"></i> Export Data</button>
    </div>
    <div class="dashboard-grid">
      <div class="card col-span-3">
        <div class="card-header"><div class="card-title"><i class="fas fa-check-circle"></i> Tasks Completed</div></div>
        <div class="stat-value">${stats.completions}</div>
        <div class="stat-change positive"><i class="fas fa-arrow-up"></i> This session</div>
      </div>
      <div class="card col-span-3">
        <div class="card-header"><div class="card-title"><i class="fas fa-magic"></i> Strategies Generated</div></div>
        <div class="stat-value">${stats.generations}</div>
        <div class="stat-change positive"><i class="fas fa-arrow-up"></i> This session</div>
      </div>
      <div class="card col-span-3">
        <div class="card-header"><div class="card-title"><i class="fas fa-clock"></i> Session Time</div></div>
        <div class="stat-value">${Math.floor(stats.total / 60)}m</div>
        <div class="stat-change neutral"><i class="fas fa-minus"></i> Current session</div>
      </div>
      <div class="card col-span-3">
        <div class="card-header"><div class="card-title"><i class="fas fa-database"></i> Data Points</div></div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-change positive"><i class="fas fa-arrow-up"></i> Tracked events</div>
      </div>
      <div class="card col-span-6">
        <div class="card-header"><div class="card-title"><i class="fas fa-chart-pie"></i> Task Distribution</div></div>
        <div style="display:flex;gap:16px;margin-top:16px">
          ${['daily','weekly','monthly','recurring','strategy'].map(tag => {
            const count = state.tasks.filter(t => t.tag === tag).length;
            const completed = state.tasks.filter(t => t.tag === tag && t.completed).length;
            const pct = count > 0 ? Math.round((completed/count)*100) : 0;
            return `<div style="flex:1;text-align:center">
              <div style="width:60px;height:60px;border-radius:50%;background:conic-gradient(var(--accent) ${pct}%, var(--bg-tertiary) ${pct}%);display:flex;align-items:center;justify-content:center;margin:0 auto 8px">
                <div style="width:48px;height:48px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:0.875rem;font-weight:700">${pct}%</div>
              </div>
              <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase">${tag}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${completed}/${count}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card col-span-6">
        <div class="card-header"><div class="card-title"><i class="fas fa-users"></i> Team Performance</div></div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
          ${['AS','JD','MK','SR'].map(member => {
            const memberTasks = state.tasks.filter(t => t.assignee === member);
            const completed = memberTasks.filter(t => t.completed).length;
            const total = memberTasks.length;
            const pct = total > 0 ? Math.round((completed/total)*100) : 0;
            return `<div style="display:flex;align-items:center;gap:12px">
              <div class="task-assignee" style="width:36px;height:36px;font-size:0.875rem">${member}</div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span style="font-size:0.875rem;font-weight:600">${member}</span>
                  <span style="font-size:0.8rem;color:var(--text-muted)">${completed}/${total} tasks</span>
                </div>
                <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%;background:var(--gradient-primary)"></div></div>
              </div>
              <span style="font-size:0.875rem;font-weight:700;color:var(--accent)">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function openBulkOperationsModal() {
  const incompleteTasks = state.tasks.filter(t => !t.completed);
  openModal(`<div class="modal-header"><div class="modal-title"><i class="fas fa-layer-group" style="color:var(--accent);margin-right:8px"></i>Bulk Operations</div><button class="modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')"><i class="fas fa-times"></i></button></div>
  <div class="modal-body">
    <div style="margin-bottom:20px">
      <div style="font-size:0.875rem;font-weight:600;margin-bottom:12px">Select tasks to perform bulk actions:</div>
      <div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
        ${incompleteTasks.map(t => `<label style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;cursor:pointer">
          <input type="checkbox" class="bulk-task-check" value="${t.id}" style="accent-color:var(--accent);width:18px;height:18px">
          <div style="flex:1"><div style="font-size:0.875rem;font-weight:500">${t.title}</div><div style="font-size:0.75rem;color:var(--text-muted)">${t.tag} | ${t.strategy}</div></div>
          <div class="task-priority ${t.priority}"></div>
        </label>`).join('')}
      </div>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn-success" onclick="executeBulk('complete')"><i class="fas fa-check"></i> Complete Selected</button>
      <button class="btn btn-secondary" onclick="executeBulk('reassign')"><i class="fas fa-user"></i> Reassign</button>
      <button class="btn btn-danger" onclick="executeBulk('delete')"><i class="fas fa-trash"></i> Delete Selected</button>
    </div>
  </div>`);
}

function executeBulk(action) {
  const checks = document.querySelectorAll('.bulk-task-check:checked');
  const ids = Array.from(checks).map(c => parseInt(c.value));
  if (ids.length === 0) { showToast('No tasks selected', 'warning'); return; }
  if (action === 'complete') bulkComplete(ids);
  else if (action === 'delete') bulkDelete(ids);
  else if (action === 'reassign') {
    const who = prompt('Enter assignee initials (AS/JD/MK/SR):', 'AS');
    if (who) bulkReassign(ids, who.toUpperCase());
  }
  document.getElementById('modal-overlay').classList.remove('active');
}

function openImportExportModal() {
  openModal(`<div class="modal-header"><div class="modal-title"><i class="fas fa-exchange-alt" style="color:var(--accent);margin-right:8px"></i>Import / Export</div><button class="modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')"><i class="fas fa-times"></i></button></div>
  <div class="modal-body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <div style="font-size:1rem;font-weight:700;margin-bottom:12px"><i class="fas fa-download" style="color:var(--success);margin-right:8px"></i>Export Data</div>
        <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:16px">Download all your data as JSON or CSV for backup or migration.</p>
        <button class="btn btn-success" style="width:100%;margin-bottom:8px" onclick="exportData('json')"><i class="fas fa-file-code"></i> Export as JSON</button>
        <button class="btn btn-secondary" style="width:100%" onclick="exportData('csv')"><i class="fas fa-file-csv"></i> Export Tasks as CSV</button>
      </div>
      <div>
        <div style="font-size:1rem;font-weight:700;margin-bottom:12px"><i class="fas fa-upload" style="color:var(--accent);margin-right:8px"></i>Import Data</div>
        <p style="font-size:0.875rem;color:var(--text-muted);margin-bottom:16px">Restore from a previous backup or import from another system.</p>
        <textarea class="form-textarea" id="import-json" placeholder="Paste JSON data here..." style="min-height:120px;margin-bottom:12px"></textarea>
        <button class="btn btn-primary" style="width:100%" onclick="importData(document.getElementById('import-json').value)"><i class="fas fa-upload"></i> Import Data</button>
      </div>
    </div>
  </div>`);
}

function openKeyboardShortcutsModal() {
  openModal(`<div class="modal-header"><div class="modal-title"><i class="fas fa-keyboard" style="color:var(--accent);margin-right:8px"></i>Keyboard Shortcuts</div><button class="modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')"><i class="fas fa-times"></i></button></div>
  <div class="modal-body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:0.875rem;font-weight:700;margin-bottom:12px;color:var(--text-secondary)">Navigation</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[['Ctrl + 1','Dashboard'],['Ctrl + 2','Strategy'],['Ctrl + 3','Action Plan'],['Ctrl + 4','SEO Data'],['Ctrl + 5','AI Assistant']].map(([key,action])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-tertiary);border-radius:8px"><span style="font-size:0.875rem">${action}</span><kbd style="background:var(--bg-card);padding:4px 10px;border-radius:6px;font-size:0.75rem;font-family:monospace;border:1px solid var(--border)">${key}</kbd></div>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:0.875rem;font-weight:700;margin-bottom:12px;color:var(--text-secondary)">Actions</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[['Ctrl + K','Focus Search'],['Ctrl + N','Quick Add'],['Ctrl + /','This Help'],['Esc','Close Modal']].map(([key,action])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg-tertiary);border-radius:8px"><span style="font-size:0.875rem">${action}</span><kbd style="background:var(--bg-card);padding:4px 10px;border-radius:6px;font-size:0.75rem;font-family:monospace;border:1px solid var(--border)">${key}</kbd></div>`).join('')}
        </div>
      </div>
    </div>
  </div>`);
}

// Add keyboard shortcut for help
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    openKeyboardShortcutsModal();
  }
  if (e.key === 'Escape') {
    document.getElementById('modal-overlay').classList.remove('active');
  }
});

// Update renderActionPlan to include bulk operations button
const originalRenderActionPlan = renderActionPlan;
renderActionPlan = function(container) {
  originalRenderActionPlan(container);
  // Add bulk operations button after the filter tabs
  const filterTabs = container.querySelector('.filter-tabs');
  if (filterTabs) {
    const bulkBtn = document.createElement('button');
    bulkBtn.className = 'btn btn-sm btn-secondary';
    bulkBtn.style.cssText = 'margin-left:auto;';
    bulkBtn.innerHTML = '<i class="fas fa-layer-group"></i> Bulk';
    bulkBtn.onclick = openBulkOperationsModal;
    filterTabs.appendChild(bulkBtn);
  }
};

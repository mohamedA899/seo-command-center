// SEO COMMAND CENTER PRO - ENHANCEMENT MODULE
// Service Worker, IndexedDB, Advanced Analytics, Bulk Operations, Keyboard Shortcuts

// SERVICE WORKER
const SW_CODE = `const CACHE_NAME='seo-command-v1';const STATIC_ASSETS=['/','/seo_command_center_pro.html'];self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS)));self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>{if(r)return r;return fetch(e.request).then(n=>{if(n&&n.status===200){const c=n.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,c))}return n}).catch(()=>{if(e.request.mode==='navigate'){return new Response('<html><body style="background:#0a0e1a;color:#f1f5f9;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Offline Mode</h1><p>You are currently offline. Some features may be limited.</p><button onclick="location.reload()" style="background:#3b82f6;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer">Retry Connection</button></div></body></html>',{headers:{'Content-Type':'text/html'}})}})}))});`;

if('serviceWorker' in navigator){const blob=new Blob([SW_CODE],{type:'application/javascript'});const swUrl=URL.createObjectURL(blob);navigator.serviceWorker.register(swUrl).then(r=>console.log('SW registered')).catch(e=>console.log('SW failed',e))}

// INDEXEDDB
const DB_NAME='SEOCommandDB',DB_VERSION=1;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onerror=()=>rej(r.error);r.onsuccess=()=>res(r.result);r.onupgradeneeded=e=>{const db=e.target.result;['tasks','strategies','settings','offlineQueue'].forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,s==='settings'?{keyPath:'key'}:s==='offlineQueue'?{keyPath:'id',autoIncrement:true}:{keyPath:'id'})})}})}
async function saveToDB(store,data){const db=await openDB();const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(data)}
async function getAllDB(store){const db=await openDB();return db.transaction(store,'readonly').objectStore(store).getAll()}

// Auto-save every 30s
setInterval(async()=>{await saveToDB('settings',{key:'profile',value:state.websiteProfile});state.tasks.forEach(t=>saveToDB('tasks',t));state.strategies.forEach(s=>saveToDB('strategies',s))},30000);

// Load on startup
async function loadPersisted(){try{const p=await getAllDB('settings');const prof=p.find(x=>x.key==='profile');if(prof)state.websiteProfile={...state.websiteProfile,...prof.value};const t=await getAllDB('tasks');if(t.length)state.tasks=t;const s=await getAllDB('strategies');if(s.length)state.strategies=s}catch(e){}}

// ANALYTICS
const analytics={events:[],track(e,d={}){this.events.push({e,d,t:new Date().toISOString()});if(this.events.length>1000)this.events.shift()},stats(){return{completions:this.events.filter(e=>e.e==='task_complete').length,generations:this.events.filter(e=>e.e==='strategy_generate').length,total:this.events.length}}};

// KEYBOARD SHORTCUTS
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey){switch(e.key){case'k':e.preventDefault();document.getElementById('global-search').focus();break;case'n':e.preventDefault();openQuickAdd();break;case'1':e.preventDefault();navigateTo('dashboard');break;case'2':e.preventDefault();navigateTo('strategy');break;case'3':e.preventDefault();navigateTo('action-plan');break;case'4':e.preventDefault();navigateTo('seo-data');break;case'5':e.preventDefault();navigateTo('ai-assistant');break}}});

// BULK OPERATIONS
function bulkComplete(ids){ids.forEach(id=>{const t=state.tasks.find(x=>x.id===id);if(t)t.completed=true});showToast(ids.length+' tasks completed','success');renderSection(state.currentSection)}
function bulkDelete(ids){state.tasks=state.tasks.filter(t=>!ids.includes(t.id));showToast(ids.length+' tasks deleted','info');renderSection(state.currentSection)}
function bulkReassign(ids,who){ids.forEach(id=>{const t=state.tasks.find(x=>x.id===id);if(t)t.assignee=who});showToast(ids.length+' tasks reassigned to '+who,'success');renderSection(state.currentSection)}

// ADVANCED SEARCH
function advancedSearch(query,filters={}){let r=state.tasks;if(query)r=r.filter(t=>t.title.toLowerCase().includes(query.toLowerCase()));if(filters.tag)r=r.filter(t=>t.tag===filters.tag);if(filters.priority)r=r.filter(t=>t.priority===filters.priority);if(filters.assignee)r=r.filter(t=>t.assignee===filters.assignee);if(filters.completed!==undefined)r=r.filter(t=>t.completed===filters.completed);if(filters.dateFrom)r=r.filter(t=>t.dueDate>=filters.dateFrom);if(filters.dateTo)r=r.filter(t=>t.dueDate<=filters.dateTo);return r}

// EXPORT DATA
function exportData(format='json'){const data={profile:state.websiteProfile,strategies:state.strategies,tasks:state.tasks,recurring:state.recurringTemplates,exportedAt:new Date().toISOString()};if(format==='json'){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='seo-command-backup-'+new Date().toISOString().split('T')[0]+'.json';a.click()}else if(format==='csv'){let csv='ID,Title,Tag,Priority,Assignee,Completed,Due Date,Strategy\n';state.tasks.forEach(t=>{csv+=`${t.id},"${t.title}",${t.tag},${t.priority},${t.assignee},${t.completed},${t.dueDate},"${t.strategy}"\n`});const blob=new Blob([csv],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='tasks-'+new Date().toISOString().split('T')[0]+'.csv';a.click()}}

// IMPORT DATA
function importData(jsonStr){try{const data=JSON.parse(jsonStr);if(data.profile)state.websiteProfile={...state.websiteProfile,...data.profile};if(data.strategies)state.strategies=data.strategies;if(data.tasks)state.tasks=data.tasks;if(data.recurring)state.recurringTemplates=data.recurring;showToast('Data imported successfully!','success');renderSection(state.currentSection)}catch(e){showToast('Import failed: Invalid JSON','danger')}}

// PERFORMANCE MONITORING
const perf={marks:[],mark(name){this.marks.push({name,time:performance.now()})},getReport(){return this.marks.map((m,i)=>({name:m.name,elapsed:i>0?(m.time-this.marks[i-1].time).toFixed(2)+'ms':'0ms'}))}};

// NOTIFICATION SCHEDULER
function scheduleNotification(title,message,time,type='info'){const delay=new Date(time)-new Date();if(delay>0){setTimeout(()=>showToast(message,type),delay);return true}return false}

// DATA SYNC SIMULATION (for offline/online)
let isOnline=true;
window.addEventListener('online',()=>{isOnline=true;document.getElementById('connection-status').className='connection-status online';document.getElementById('connection-status').innerHTML='<span class="api-status-dot api-connected"></span>Online';showToast('Connection restored. Syncing data...','success')});
window.addEventListener('offline',()=>{isOnline=false;document.getElementById('connection-status').className='connection-status offline';document.getElementById('connection-status').innerHTML='<span class="api-status-dot api-disconnected"></span>Offline';showToast('You are offline. Changes will sync when connection returns.','warning')});

console.log('SEO Command Center Pro - Enhancement Module loaded');
console.log('Shortcuts: Ctrl+K (search), Ctrl+N (new), Ctrl+1-5 (navigate)');

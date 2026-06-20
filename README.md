# SEO Command Center Pro

## Quick Start

### Option 1: Open Directly
Double-click `index.html` in any modern browser.

### Option 2: Local Server (Recommended)
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# PHP
php -S localhost:8080
```
Then open `http://localhost:8080`

### Option 3: Deploy to Netlify (Free)
1. Go to https://app.netlify.com/drop
2. Drag this folder onto the page
3. Get instant live URL

### Option 4: Deploy to Vercel (Free)
```bash
npm i -g vercel
vercel --prod
```

## Features
- Adaptive Strategy Engine (CMS × Niche × Market × Size)
- Task Management (Daily/Weekly/Monthly/Recurring/Strategy)
- Smart Notifications & Alarms
- Calendar & Kanban Board
- SEO Data Hub (GSC, Ahrefs, SEMrush, Screaming Frog)
- AI SEO Assistant
- Client Reports (White-label PDF)
- Live Collaboration
- Offline Support (Service Worker + IndexedDB)
- Keyboard Shortcuts (Ctrl+1-5, Ctrl+K, Ctrl+N, Ctrl+/)
- Bulk Operations
- Import/Export (JSON/CSV)
- Advanced Analytics

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl + 1 | Dashboard |
| Ctrl + 2 | Strategy |
| Ctrl + 3 | Action Plan |
| Ctrl + 4 | SEO Data |
| Ctrl + 5 | AI Assistant |
| Ctrl + K | Focus Search |
| Ctrl + N | Quick Add |
| Ctrl + / | Shortcuts Help |
| Esc | Close Modal |

## File Structure
```
├── index.html              # Main application (130KB)
├── docs/
│   └── BACKEND_ARCHITECTURE.md  # Full backend spec
└── src/
    ├── enhancements.js     # Service Worker, IndexedDB, Analytics
    └── advanced_features.js # Bulk ops, Import/Export, Shortcuts
```

## Backend Setup (Optional)
See `docs/BACKEND_ARCHITECTURE.md` for:
- Node.js + Express + PostgreSQL schema
- API endpoints
- WebSocket events
- Background jobs
- Security & scaling

## License
MIT

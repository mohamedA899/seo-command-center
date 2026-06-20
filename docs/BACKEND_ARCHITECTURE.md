# SEO Command Center Pro - Backend Architecture

## Tech Stack
- **Frontend**: Vanilla JS (current) → React/Vue migration path
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (primary) + Redis (cache/sessions)
- **Real-time**: Socket.IO (WebSockets)
- **AI**: OpenAI GPT-4 API / Claude API
- **SEO APIs**: Google Search Console API, Ahrefs API, SEMrush API
- **Auth**: JWT + OAuth 2.0
- **Queue**: Bull (Redis-based) for background jobs
- **Storage**: AWS S3 for reports/assets

## Database Schema

### users
- id, email, name, avatar, role, created_at

### websites
- id, user_id, name, url, cms, niche, market, size, team_size, budget, config_json

### strategies
- id, website_id, title, description, icon, status, progress, priority, deadline, created_at

### tasks
- id, strategy_id, title, tag, priority, assignee_id, completed, due_date, created_at

### recurring_templates
- id, website_id, name, frequency, tasks_count, last_run, next_run, active, config

### seo_data_snapshots
- id, website_id, source(gsc/ahrefs/semrush), data_json, captured_at

### reports
- id, website_id, title, type, status, pages, size, file_url, created_at

### team_members
- id, website_id, user_id, role, permissions

### activity_log
- id, website_id, user_id, action, entity_type, entity_id, metadata, created_at

## API Endpoints

### Auth
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout

### Websites
GET /api/websites
POST /api/websites
PUT /api/websites/:id
DELETE /api/websites/:id

### Strategies
GET /api/websites/:id/strategies
POST /api/websites/:id/strategies/generate  # AI-generated
PUT /api/strategies/:id
DELETE /api/strategies/:id

### Tasks
GET /api/websites/:id/tasks
POST /api/tasks
PUT /api/tasks/:id
DELETE /api/tasks/:id
PATCH /api/tasks/:id/complete

### SEO Data
GET /api/websites/:id/seo-data
POST /api/websites/:id/seo-data/sync
GET /api/websites/:id/seo-data/history

### Reports
GET /api/websites/:id/reports
POST /api/websites/:id/reports/generate
GET /api/reports/:id/download

### AI
POST /api/ai/chat
POST /api/ai/generate-meta
POST /api/ai/analyze-competitor
POST /api/ai/content-ideas

### Real-time (Socket.IO)
connection → join:website_id
task:update → broadcast to room
cursor:move → broadcast to room
chat:message → broadcast to room

## Background Jobs (Bull Queue)

### job:sync-seo-data
- Runs every hour for active websites
- Fetches GSC, Ahrefs, SEMrush data
- Stores snapshots
- Triggers alerts if anomalies detected

### job:generate-recurring-tasks
- Runs daily at 6 AM
- Creates tasks from active recurring templates
- Assigns based on team availability

### job:generate-report
- Triggered on demand
- Compiles data into PDF
- Uploads to S3
- Notifies user

### job:ai-content-generation
- Background AI processing
- Generates meta descriptions, outlines
- Stores results for review

## Security
- Rate limiting: 100 req/min per IP
- CORS: whitelist domains
- Input validation: Joi/Zod
- SQL injection prevention: parameterized queries
- XSS protection: sanitize HTML output
- CSRF tokens for state-changing ops

## Scaling
- Horizontal: PM2 cluster mode
- Database: read replicas
- Cache: Redis cluster
- CDN: CloudFlare for static assets
- File storage: S3 + CloudFront

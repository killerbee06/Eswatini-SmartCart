# SmartCart

> Multi-vendor marketplace for Eswatini — full-stack monorepo with React frontend and Express API backend.

## Project Structure

```
smartcart/
├── frontend/          # React + Vite (deployable to Vercel)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components (10 routes)
│   │   ├── context/       # Auth context (Supabase)
│   │   ├── services/      # API layer + Supabase client
│   │   └── App.jsx        # Root with routing
│   ├── vite.config.js
│   └── package.json
│
├── backend/           # Express + Knex + PostgreSQL
│   ├── src/
│   │   ├── modules/       # 10 API modules (auth, orders, payments, etc.)
│   │   ├── services/      # 7 service layers + payment providers
│   │   ├── middleware/     # Auth, RBAC, validation, security, audit
│   │   └── shared/        # Constants, errors, utilities
│   ├── database/
│   │   ├── migrations/    # 4 migrations (20 tables)
│   │   └── seeds/         # 3 seed files
│   ├── tests/             # 6 test suites (325 tests)
│   └── package.json
│
└── README.md
```

## Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env    # Configure Supabase + PostgreSQL credentials
npm run migrate
npm run seed
npm run dev             # Runs on http://localhost:5000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env    # Configure VITE_API_URL + Supabase anon key
npm run dev             # Runs on http://localhost:3000 (proxies API to :5000)
```

## Frontend

- **React 18** + **Vite 5** — fast dev and production builds
- **React Router** — client-side routing with protected routes
- **Supabase Auth** — client-side auth (signup, login, session)
- **10 pages**: Home, Product Detail, Cart, Orders, Login, Register, Merchant, Driver, Admin, Tracking
- Communicates with backend exclusively through `services/api.js`
- Deployable independently to **Vercel** via `npm run build`

### Environment Variables (Frontend — safe/public only)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

## Backend

- **Express 4** + **Socket.IO** — REST API + real-time
- **Knex.js** + **PostgreSQL** — database with migrations
- **Supabase Auth** — server-side JWT verification
- **RBAC** — permission-based access control (9 roles, 40+ permissions)
- **60+ API endpoints** across 10 modules
- **325 passing tests** (6 test suites)
- **Security**: Helmet, rate limiting, input sanitization, audit logging, bot protection

### Key Modules
| Module | Description |
|--------|-------------|
| Auth | Register, login, JWT session |
| Orders | Checkout, status machine, merchant view |
| Payments | Idempotent processing, webhooks, refunds |
| Delivery | OTP verification, state machine |
| Tracking | Real-time GPS, ETA, Socket.IO |
| Payouts | Batch generation, approval workflow |
| Reports | Revenue, ledger, refund analytics |
| Notifications | Templates, real-time push |

## Deployment

- **Frontend**: `cd frontend && npm run build` → deploy `dist/` to Vercel
- **Backend**: Deploy to any Node.js host (Railway, Render, Fly.io)
- Set `VITE_API_URL` on Vercel to your backend's public URL
- Configure CORS in backend `.env` to allow your Vercel domain

## Testing

```bash
cd backend
npm test               # Run all 325 tests
node tests/regression.js   # M1: Architecture
node tests/milestone2.js   # M2: Payments & Delivery
node tests/milestone3.js   # M3: Payouts
node tests/milestone4.js   # M4: Live Tracking
node tests/milestone5.js   # M5: Admin Dashboard
node tests/milestone6.js   # M6: Notifications
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router 6 |
| Auth | Supabase Auth (client + server) |
| Backend | Express 4, Socket.IO |
| Database | PostgreSQL via Knex.js |
| Validation | Joi |
| Security | Helmet, CORS, Rate Limiting, Audit Logging |

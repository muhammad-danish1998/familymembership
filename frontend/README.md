# Family Fund System — Frontend

A web application for a mutual family/village support fund.

## Quick Start (Phase A — Mock Data Mode)

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Demo Credentials (Mock Mode)
- **Family Page**:
  - Access PIN: `123456`
- **Admin Dashboard**:
  - Email: `admin@example.test`
  - Password: `admin123`

---

## Available Commands

| Purpose | Command |
|---|---|
| Start Dev Server | `npm run dev` |
| Run Tests | `npm test` |
| Lint Code | `npm run lint` |
| Build Demo App (Mock Allowed) | `npm run build:demo` |
| Build Production Bundle (Requires Supabase) | `npm run build` |

---

## Architecture & Data Source

The application uses an adapter pattern for data access (`src/services/`):
- `VITE_DATA_SOURCE=mock`: Runs Phase A in browser using `localStorage` + initial fictional seed data. No backend server or internet connection required.
- `VITE_DATA_SOURCE=supabase`: Runs Phase B with live Supabase authentication, PostgreSQL database RPCs, and Edge Functions.

> ⚠️ Production builds (`npm run build`) will refuse to compile if `VITE_DATA_SOURCE` is set to `mock`.

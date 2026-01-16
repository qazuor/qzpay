# QZPay Playground

Interactive testing environment for QZPay billing and payments library.

## Development Setup

### 1. Environment Configuration

Create a `.env.local` file in this directory with your configuration:

```bash
# Backend API URL (optional)
# Default: http://localhost:3010
VITE_BACKEND_URL=http://localhost:3010
```

### 2. Backend Server Configuration

Create a `server/.env` file with your payment provider credentials:

```bash
# CORS Configuration
# Default: http://localhost:3001 (Vite dev server)
ALLOWED_ORIGINS=http://localhost:3001

# Stripe Configuration (optional)
STRIPE_SECRET_KEY=sk_test_...

# MercadoPago Configuration (optional)
MERCADOPAGO_ACCESS_TOKEN=TEST-...
```

See `server/.env.example` for more details.

### 3. Run Development Servers

```bash
# Run both frontend and backend concurrently
pnpm dev

# Or run them separately
pnpm dev:frontend  # Vite dev server (port 3001)
pnpm dev:backend   # Backend API server (port 3010)
```

## Architecture

### Frontend (Vite + React)
- **Port**: 3001 (configured in `vite.config.ts`)
- **Environment**: Uses `VITE_*` prefixed variables
- **State Management**: Zustand + localStorage adapter

### Backend (Hono + Node)
- **Port**: 3010 (default, configurable via `PORT` env var)
- **CORS**: Restrictive by default, configured via `ALLOWED_ORIGINS`
- **Purpose**: Handles real payment provider API calls (Stripe, MercadoPago)

## Configuration Files

| File | Purpose |
|------|---------|
| `.env.example` | Frontend environment variables template |
| `.env.local` | Your local frontend configuration (gitignored) |
| `server/.env.example` | Backend environment variables template |
| `server/.env` | Your local backend configuration (gitignored) |
| `vite.config.ts` | Vite configuration (port, aliases, etc.) |

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:

1. Verify `ALLOWED_ORIGINS` in `server/.env` includes `http://localhost:3001`
2. Restart the backend server
3. Check server logs for CORS rejection messages

See `server/CORS_TEST.md` for detailed testing guide.

### Backend Connection Issues

If the frontend can't connect to the backend:

1. Verify backend is running on port 3010: `curl http://localhost:3010/health`
2. Check `VITE_BACKEND_URL` in `.env.local` matches the backend URL
3. Ensure both servers are running (`pnpm dev`)

## Scripts

```bash
pnpm dev              # Start both frontend and backend
pnpm dev:frontend     # Start only frontend (port 3001)
pnpm dev:backend      # Start only backend (port 3010)
pnpm build            # Build for production
pnpm preview          # Preview production build
pnpm lint             # Run linter
pnpm lint:fix         # Fix linting issues
pnpm typecheck        # Run TypeScript type checking
```

## Learn More

- [QZPay Documentation](../../README.md)
- [Stripe Integration](../../packages/stripe/README.md)
- [MercadoPago Integration](../../packages/mercadopago/README.md)

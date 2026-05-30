# CommuTrip

A community-based tourism platform connecting travellers with local providers in destination communities — built as a Master's thesis project at Ghent University.

## What it does

CommuTrip lets travellers plan trips stop by stop, discover locally-run activities near each stop, and book directly with providers. A portion of every booking is pledged to a community fund (controlled by the local provider collective), supporting projects like school renovations, heritage preservation, or coastal cleanups. Travellers can also top up the fund voluntarily at checkout.

Providers join verified communities, set their own pledge rate, and manage their activity listings. Community managers submit impact reports and track fund contributions over time.

## Tech stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Row-Level Security, SECURITY DEFINER RPCs)
- **Maps**: Google Maps (`@vis.gl/react-google-maps`)
- **Auth**: Supabase Auth with role-based access (`traveller` / `provider` / `admin`)

## Getting started

```bash
npm install
```

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
```

```bash
npm run dev        # dev server at http://localhost:8080
npm run build      # production build
npm run test       # unit tests (vitest)
```

## Key concepts

| Concept | Description |
|---|---|
| **Trip** | A traveller's planned journey, broken into ordered stops |
| **Trip Stop** | A location with arrival/departure dates; bookings are anchored here |
| **Activity** | A provider-run experience (recurring or one-time) with a schedule and capacity |
| **Community** | A verified collective of local providers sharing a community fund |
| **Provider Pledge** | A percentage of each booking automatically contributed to the community fund |

## Demo accounts

Seed the database with `python seed_morocco.py` (requires `pip install supabase`).
All demo accounts use password `demo1234`.

| Email | Role |
|---|---|
| sarah@demo.com | Traveller |
| omar@demo.com | Provider / Community manager (Imlil) |
| khalid@demo.com | Provider / Community manager (Marrakech) |
| amina@demo.com | Provider / Community manager (Essaouira) |
| youssef@demo.com | Provider (Imlil) |
| fatima@demo.com | Provider (Imlil) |

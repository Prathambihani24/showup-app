# 🎯 Showup — Campus Plans That Actually Happen

> **Drop a plan. Nearby students join before spots fill. No group chat noise.**

<p align="center">
  <img src="https://img.shields.io/badge/Expo-54-000020?style=for-the-badge&logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/PostGIS-Spatial-4287F5?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-FFD700?style=for-the-badge" />
</p>

<p align="center">
  <a href="#-live-demo">Live Demo</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-api-rpc">RPC Reference</a> •
  <a href="#-deployment">Deploy</a>
</p>

---

## 🎬 The Problem

```
┌─────────────────────────────────────────────────────────────────┐
│  📱  15,000 students. 200m apart. Same boring evening.         │
│                                                                  │
│  Group chats die. Plans stay abstract.                         │
│  "Who's down?" → 47 replies → 3 show up.                       │
└─────────────────────────────────────────────────────────────────┘
```

## ✨ The Solution

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀  Drop a plan → Nearby students see it instantly →          │
│      Tap join → Spots fill → Chat opens → People stand there.  │
└─────────────────────────────────────────────────────────────────┘
```

**Showup** is a hyperlocal campus app that turns "who's down?" into real plans with real people.

| Feature | What It Does |
|---------|--------------|
| ⚡ **Live Feed** | Plans within 5km, sorted by distance, expire in hours |
| 🎯 **Spot-Limited** | Creator sets spots (1–20). Full = gone. FOMO does the pushing. |
| 💬 **Auto-Chat** | Opens the moment someone joins. No "where is ground 2?" confusion. |
| 🏷️ **Categories** | Food 🍜 • Sport 🏸 • Chill 🧋 • Study 📚 • Vibe 🚗 • Gaming 🎮 |
| 📍 **Campus-Verified** | Only `.edu` emails from BVCOE, MIT WPU, Indira, Sinhgad |
| 🔗 **Referral Queue** | Waitlist position jumps when friends join via your link |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Expo + React Native)                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Home    │  │ Create  │  │ Chat    │  │ Favs    │  │ Profile │   │
│  │ Feed    │  │ Plan    │  │ Realtime│  │ Saved   │  │ Settings│   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
└───────┼────────────┼────────────┼────────────┼────────────┼────────┘
        │            │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE BACKEND                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ PostgreSQL   │  │ PostGIS      │  │ Realtime     │  │ Auth     │  │
│  │ + RLS        │  │ GiST Indexes │  │ (plan_msgs)  │  │ (OTP)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  │
│         │                 │                 │               │        │
│         ▼                 ▼                 ▼               ▼        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    RPC FUNCTIONS                              │   │
│  │  fetch_plans_near_me  •  join_plan  •  leave_plan            │   │
│  │  cancel_plan  •  cleanup_expired_plans  •  fetch_nearest     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 🗄️ Database Schema

```sql
profiles ──────┬────── plans ──────┬────── plan_joins
               │                   │
               │                   ├── saved_plans
               │                   │
               │                   ├── plan_messages (realtime)
               │                   │
               │                   └── reports
               │
               └──── expo_push_tokens
```

**Key indexes:**
- `idx_plans_bvcoe_active_location` — Partial GiST on `location` WHERE `is_active=true AND campus='BVCOE Dhankawadi'`
- `idx_plans_campus_active_location` — Partial GiST for all campuses
- `idx_plans_location_gist` — Full GiST for map viewport queries

---

## 🚀 Quick Start

### Prerequisites
- Node 20+
- Expo CLI: `npm i -g @expo/cli`
- Supabase account (free tier works)

### 1. Clone & Install
```bash
git clone https://github.com/Prathambihani24/showup-app-.git
cd showup-app-
npm install --legacy-peer-deps
```

### 2. Environment
```bash
cp .env.example .env
# Fill in your Supabase URL + anon key
```

### 3. Database (one-time)
Run these **in order** in Supabase SQL Editor:

| Migration | Purpose |
|-----------|---------|
| `supabase/migrations/20260820000001_baseline.sql` | Tables, RLS, indexes, triggers |
| `supabase/migrations/20260827_complete_fix_v2.sql` | Missing columns + spatial RPCs |
| `supabase/migrations/20260827_plan_lifecycle_rpcs.sql` | join/leave/cancel + realtime |

### 4. Run
```bash
# Development
npx expo start

# Web export (for waitlist page)
npx expo export -p web
```

---

## 📡 RPC Reference

### Spatial Queries
```typescript
// Plans near me (PostGIS KNN + radius)
fetch_plans_near_me({
  user_lat: number,
  user_lng: number,
  search_radius_m?: number,     // default 5000
  result_limit?: number,        // default 20
  campus_name?: string          // default 'BVCOE Dhankawadi'
})

// Paginated feed (cursor-based)
fetch_plans_near_me_paginated({
  user_lat, user_lng,
  search_radius_m, result_limit,
  cursor_distance_m?: number,   // for infinite scroll
  campus_name
})

// Pure KNN (closest N)
fetch_nearest_plans({ user_lat, user_lng, result_limit, campus_name })

// Map viewport (bbox)
fetch_plans_in_bbox({ min_lng, min_lat, max_lng, max_lat, result_limit, campus_name })
```

**Returns:** `id, user_id, user_name, activity, location_name, lat, lng, campus, category, time_label, starts_at, spots_total, spots_left, created_at, distance_m, joined_count, is_joined`

### Plan Lifecycle (requires auth)
```typescript
join_plan(p_plan_id: uuid)     // Returns { ok, spots_left } or { ok, reason }
leave_plan(p_plan_id: uuid)    // Returns { ok } or { ok, reason }
cancel_plan(p_plan_id: uuid)   // Returns { ok } or { ok, reason }
cleanup_expired_plans()        // Returns integer (count deactivated)
```

### Waitlist (public, no auth)
```typescript
join_waitlist({
  p_email: string,
  p_picks: string[],      // ["Football", "Chai run"]
  p_wish: string,         // optional free-text
  p_ref: string           // referral code from URL
})
// Returns { queue_pos, out_ref_code, referrals }
```

---

## 🎨 Waitlist Page

Standalone static page at `/showup-waitlist/index.html` — deploys anywhere (Vercel, Netlify, GitHub Pages).

**Features:**
- 3-step signup: Email → Picks → Wish
- Real queue position from Supabase
- Unique referral code (`ABC123EF`)
- WhatsApp share button (primary in India)
- Offline fallback → localStorage
- Dark/light palette switcher (persists)

```bash
# Deploy to Vercel
npx vercel ./showup-waitlist

# Or Netlify
netlify deploy --dir=showup-waitlist
```

---

## 📦 Project Structure

```
showup-app/
├── app/                    # Expo Router (if migrated) or legacy screens/
├── screens/
│   ├── HomeScreen.js       # Live feed + spatial queries
│   ├── CreatePlanScreen.js # Drop a plan
│   ├── ChatScreen.js       # Realtime messages
│   ├── ProfileScreen.js    # User settings
│   ├── FavoritesScreen.js  # Saved plans
│   └── AuthScreen.js       # Campus email OTP
├── lib/
│   ├── supabase.js         # Client + auth config
│   ├── spatial-queries.js  # PostGIS RPC wrappers
│   ├── user.js             # Profile helpers
│   └── theme.js            # Design tokens
├── supabase/
│   └── migrations/         # SQL migrations (run in order)
├── showup-waitlist/        # Static landing page
│   └── index.html
├── .env.example
├── package.json
└── README.md
```

---

## 🔐 Security

- **RLS enabled** on all tables
- **Anon key** only: `EXPO_PUBLIC_SUPABASE_ANON_KEY` (no service role in client)
- **Authenticated-only** reads on `plans`, `profiles`, `plan_messages`
- **Owner-scoped** writes on `saved_plans`, `plan_joins`, `reports`
- **Plan mutations** only via RPCs (atomic, race-free)

---

## 🧪 Quality Gates

```bash
# All must pass before PR
npx expo-doctor              # ✅ 18/18 checks
npx expo export -p web       # ✅ Web build
curl -I <supabase>/rest/v1/waitlist_signups  # ✅ RLS blocks anon SELECT
```

---

## 📈 Roadmap

| Phase | Target | Status |
|-------|--------|--------|
| **Waitlist** | 400 BVCOE signups | 🔄 In progress |
| **Soft Launch** | 50 DAU, seeded plans | ⏳ |
| **Campus 2** | MIT WPU Kothrud | ⏳ |
| **Monetization** | Venue partnerships (OpsLayer) | 💡 |

---

## 🤝 Contributing

1. Fork → Branch → PR
2. `expo-doctor` must pass
3. No secrets in commits
4. Update migrations for schema changes

---

## 📄 License

MIT — Built with ☕ at BVCOE Pune by [Pratham Bihani](https://github.com/Prathambihani24)

---

<p align="center">
  <strong>Made in Pune 🇮🇳</strong><br>
  <sub>Launching first at BVCOE Dhankawadi</sub>
</p>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=18&duration=3000&pause=1000&color=7C3AED&center=true&vCenter=true&width=600&lines=Drop+a+plan.;Nearby+students+join.;Spots+fill.;Chat+opens.;People+stand+there." />
</p>
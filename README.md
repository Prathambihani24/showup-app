<div align="center">
  <img src="assets/logo.png" alt="showup logo" width="200"/>
  
  # showup
  
  **Drop a plan. Nearby students join before spots fill.**
  
  [![Expo](https://img.shields.io/badge/Expo-54-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
  [![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
  [![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
  [![License](https://img.shields.io/badge/License-MIT-FFD700?style=for-the-badge)](LICENSE)

  [Join Waitlist](#-waitlist) • [Architecture](#-architecture) • [Quick Start](#-quick-start)
</div>

---

## The Problem

Every college student has this moment multiple times a week.

> Free. Bored. Open WhatsApp. Send "anyone free?" Get 3 replies. Plan dies.

WhatsApp fails for spontaneous plans because it only works within closed networks. There is no app in India that enables low-friction spontaneous plans with people outside your existing group — built for college students in tier-2 cities.

## The Solution

showup. is a live feed of spontaneous plans near you right now.

Open the app → see what is happening within 5km → tap "i'm in" → show up.

Or drop your own plan in 30 seconds and watch who joins.

---

## Screenshots

<!-- Add 3-4 real screenshots here -->
| Home Feed | Drop a Plan | Profile |
|---|---|---|
| ![feed](screenshots/feed.png) | ![create](screenshots/create.png) | ![profile](screenshots/profile.png) |

---

## Features

| Feature | Description |
|---|---|
| ⚡ Live Feed | Real-time plans within 50km sorted by GPS distance |
| 🎯 Spot Limited | Creator sets spots 1-20. Full = gone. |
| 📍 Location First | Real GPS coordinates, Haversine distance per card |
| ❤️ Save Plans | Bookmark plans for later |
| 🚩 Report | Flag inappropriate plans |
| 🔍 Search + Filter | By category or location name |

## Tech Stack

- **Frontend:** React Native + Expo SDK 54
- **Backend:** Supabase (PostgreSQL + Auth + Real-time)
- **Location:** expo-location + Haversine formula
- **Navigation:** React Navigation v6
- **Storage:** AsyncStorage

## Architecture

```
Client (React Native + Expo)
├── HomeScreen      — Live plan feed with GPS filter
├── CreateScreen    — Drop a plan with location picker  
├── FavoritesScreen — Saved plans from Supabase
└── ProfileScreen   — User profile + stats

Supabase Backend
├── plans           — Active plans with lat/lng
├── users           — User profiles
├── plan_joins      — Join records
└── saved_plans     — Saved plan records
```

## Quick Start

```bash
git clone https://github.com/Prathambihani24/showup-app.git
cd showup-app
npm install
cp .env.example .env
# Add your Supabase URL and anon key to .env
npx expo start
```

## Database Setup

Run in Supabase SQL Editor in order:

```sql
-- 1. Create tables
-- See supabase/migrations/ for full migration files

-- 2. Disable RLS for development
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE plan_joins DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_plans DISABLE ROW LEVEL SECURITY;
```
## Waitlist

Launching at BVCOE Pune. Join the waitlist:
👉 [showup waitlist link]

## Built By

Pratham Bihani — [@Prathambihani24](https://github.com/Prathambihani24)

**Made in India 🇮🇳**

# Showup Backend Setup (one-time, ~15 min)

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**
2. Name it `showup-prod` (any region close to India — Singapore/Mumbai)
3. Save the database password somewhere safe
4. When the project is ready: **Project Settings → API** → copy the
   `Project URL` and the `anon public` key

## 2. Apply the schema

1. In the dashboard sidebar: **SQL Editor → New query**
2. Open `supabase/migrations/20260820000001_baseline.sql` from this repo,
   copy the **entire** file, paste, click **Run**
3. You should see `Success. No rows returned` — the tables, security
   policies, triggers, and RPCs are live

## 3. Enable email OTP login

1. Dashboard → **Authentication → Providers → Email**: make sure
   **Enable Email Provider** is ON
2. Same page: turn **Confirm email** ON (OTP flow requires it)

## 4. Fix email delivery (important)

Supabase's built-in email allows only ~2 emails/hour — your pilot will
stall at login without this:

1. Create a free account at https://resend.com → **API Keys** → create key
2. In Resend: **Domains** → add & verify your sender domain (or use
   `onboarding@resend.dev` for testing only)
3. Supabase dashboard → **Authentication → Emails → SMTP Settings**:
   - Host: `smtp.resend.com`, Port: `465`, Username: `resend`,
     Password: your Resend API key
   - Sender email: e.g. `showup@yourdomain.com`
4. Send the test email to confirm it arrives

## 5. Point the app at the project

Create `.env` in the repo root (already git-ignored):

```
EXPO_PUBLIC_SUPABASE_URL=<Project URL from step 1>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from step 1>
```

Restart `npx expo start -c` and the app is live against the new backend.

## Sanity check

SQL Editor → run:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

Every table must show `rowsecurity = true`.

```sql
select proname from pg_proc where proname in
('join_plan','leave_plan','cancel_plan','fetch_plans_near_me');
```

All four functions must be listed.

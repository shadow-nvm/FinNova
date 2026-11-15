# FinNova — Smart Personal Finance Hub

Rebuilt production app for **https://finnovahub.web.app** (Firebase project `finnova-fd6d5`).
It talks to the *existing* Firestore database, so your accounts, transactions, budgets,
goals and reminders are still there after deploying.

## What's included

- **Auth** — email/password login, account creation, "forgot password" reset, session persistence.
- **Dashboard** — monthly and all-time stats, 6-month income vs spending chart, category
  donut, budget/goal/upcoming summaries, recent activity, personalised insights.
- **Transactions** — add/edit/delete, filters (type, month, search), sorting, month grouping,
  **CSV import** and **CSV export**.
- **Budgets** — per-category monthly limits with usage bars and over-budget warnings.
- **Goals** — create/edit/delete, deposit or withdraw any amount, target dates and monthly pace.
- **Reminders** — recurring bills and savings nudges, next due date, "mark paid".
- **Reports** — month selector, 6-month comparison table and chart, category breakdown,
  largest expenses, month CSV export and a **full JSON backup**.
- **Learn** — 12 financial-literacy articles with search and categories.
- **Extras** — light/dark theme, mobile bottom navigation, toast notifications, offline
  Firestore cache, confirm dialogs before deletes, accessible dialogs and forms, demo mode.

## Data model (matches the original app)

Top-level Firestore collections, each document owned by `ownerId = <firebase uid>`:

| Collection | Fields |
| --- | --- |
| `transactions` | `ownerId`, `type` (`income`/`expense`), `category`, `amount` (number), `date` (ISO string), `note`, `createdAt` |
| `budgets` | `ownerId`, `category`, `amount`, `period: "monthly"`, `createdAt` |
| `goals` | `ownerId`, `name`, `icon`, `targetAmount`, `savedAmount`, `targetDate`, `createdAt` |
| `reminders` | `ownerId`, `type` (`bill`/`saving`), `title`, `amount`, `day`, `lastPaidDate`, `createdAt` |

Because the field names did not change, the new app reads every existing document. Nothing
is migrated or rewritten automatically.

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL. "Explore the demo" opens a local sample workspace (no account needed).
To preview the demo directly: `http://localhost:5173/?demo=1`.

## Deploy the update to the existing site

```bash
npm install
npm run build
firebase login          # once, if not already signed in
firebase deploy --only hosting
```

That publishes to the same Hosting site (`finnovahub.web.app`) as an update. `firebase.json`
pins `hosting.site` to `finnovahub`, so the deploy does not accidentally go to the project's
default `<project-id>.web.app` site. Existing Firestore data stays untouched.

If Firebase reports that the site does not exist, run `firebase hosting:sites:list` and change
the `site` value in `firebase.json` to the correct one. Hard-refresh the browser once after
deploying to discard the old cached bundle.

Security rules are included and enforce that each user can only touch documents whose
`ownerId` matches their uid. Deploy them once (safe for the existing data):

```bash
firebase deploy --only firestore:rules
```

> Deploying rules is optional for the UI update, but strongly recommended — without them the
> database may still allow public access. Keep a backup (Reports → Full backup) before any
> bulk operation you are unsure about.

## CSV import format

Export from any tracker (or the old FinNova CSV) with these headers:

```csv
Date,Type,Category,Amount,Note
2026-08-23,expense,Education,10000,College fee
2026-08-23,income,Salary,100000,August salary
```

`Date` and `Amount` are required. `Type` defaults to expense if missing or unrecognised.
Rows with invalid dates or amounts are reported before anything is written.

## Project layout

```
src/
  auth/AuthProvider.tsx    Firebase auth + demo session
  store/DataProvider.tsx   Firestore listeners + typed CRUD
  store/demo.ts            Local demo workspace with sample data
  lib/calc.ts              Money maths + insights engine
  lib/csv.ts               CSV import/export, JSON backup
  components/              App shell, dialogs, shared UI
  pages/                   Dashboard, transactions, budgets, goals, reminders, reports, learn
firestore.rules            Owner-only security rules
firebase.json              Hosting config (SPA rewrites, caching)
```

The original cached bundle and hosting snapshot that were recovered are kept in `recovery/`
for reference.

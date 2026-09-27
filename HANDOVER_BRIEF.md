# HANDOVER BRIEF: Moussa POS

## 1. Project Background
This project is an Electron + React + TypeScript desktop Point of Sale (POS) application cloned cleanly from the production-ready **Khalil POS (Zabad)** codebase.
It has full offline-first capabilities with SQLite (`better-sqlite3`), multi-device cloud synchronization via Supabase, debt tracking, inventory management, expense tracking, and offline licensing.

Target brand for this new application: **Moussa POS**

---

## 2. Architecture & Tech Stack
- **Desktop Runtime**: Electron 31 (Node.js 20+, Windows x64)
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Zustand state management
- **Local Database**: SQLite (`better-sqlite3`) managed with custom migration runner (`src/main/database/`)
- **Cloud Sync**: Offline-first two-way cloud sync with Supabase (`src/main/services/supabase-sync.service.ts`)
- **Packaging**: `electron-builder` producing NSIS installer and portable `.exe`

---

## 3. Setup & Customization Checklist for the New Assistant

When you start working in this workspace, guide the user through these essential setup steps:

### Step 1: Install Dependencies
Run:
```powershell
npm install
```

### Step 2: Initialize Fresh Git Repository
```powershell
git init
git branch -M main
git add .
git commit -m "chore: initial commit for Moussa POS template"
```
*(User will create a new repository on GitHub, e.g. `alinrbassam/Moussa-POS`, and link it with `git remote add origin ...`)*

### Step 3: Update App Identity & Branding
Ensure Windows treats Moussa POS as an independent app (separate AppData folder and SQLite database file):
1. **`package.json`**:
   - Change `"name"` to `"moussa-pos"`
   - Change `"productName"` to `"Moussa POS"`
2. **`electron-builder.yml`**:
   - Change `appId` to `"com.moussa.pos"`
   - Change `productName` to `"Moussa POS"`
   - Change `artifactName` templates to `"Moussa POS Setup ${version}.${ext}"`
3. **App Titles & Branding**:
   - Update `index.html` title to `"Moussa POS"`
   - Review header logos/names in `src/renderer/components/layout/`

### Step 4: Setup Separate Supabase Project
To keep Moussa POS data 100% isolated from any other store:
1. Create a brand new project in [Supabase](https://supabase.com).
2. Run database migrations to create the required tables (`products`, `categories`, `suppliers`, `sales`, `sale_items`, `expenses`, `customers`, `customer_debts`, etc.).
3. Update the Supabase URL and API keys in `src/main/services/supabase-sync.service.ts` (or environment config).

### Step 5: Offline Licensing (If Applicable)
If using licensing keys:
- Generate a new ECDSA key pair for Moussa POS via `tools/generate-keys.js`.
- Replace the public key in `src/shared/license-public-key.ts`.

---

## 4. How to Verify
- Run tests: `npm test`
- Run development mode: `npm run dev`
- Build production installer: `npm run build:electron`

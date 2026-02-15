# Verbose

A modern real-time communication platform built with React, TypeScript, and Supabase. Features a sleek dark glass-morphism UI with animated backgrounds and comprehensive authentication.

![React](https://img.shields.io/badge/React-19.1.1-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Supabase](https://img.shields.io/badge/Supabase-Auth-green) ![Vite](https://img.shields.io/badge/Vite-5.4-purple)

---

## Features

### Authentication
- **Email/Password** — Sign up and sign in with email
- **Google OAuth** — One-click Google sign-in
- **GitHub OAuth** — One-click GitHub sign-in
- **Anonymous/Guest Mode** — Browse and chat without an account

### User Experience
- **Dark Glass-morphism UI** — Modern frosted glass aesthetic
- **Animated Background** — Interactive Three.js shader-based floating lines
- **Decrypted Text Animation** — Smooth character-by-character text reveal
- **Gooey Navigation** — Fluid particle-based navigation effects
- **Profile Avatar** — User profile with dropdown menu showing avatar from OAuth provider

### Access Control
- **Chat** — Available to all users (including guests)
- **Voice/Video Calls** — Requires authenticated account (guests prompted to sign up)
- **Profile Management** — Full profile editing for registered users

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 19.1.1 |
| **Language** | TypeScript 5.5 |
| **Build Tool** | Vite 5.4.2 |
| **Styling** | TailwindCSS 4.1.12 |
| **UI Components** | @jamsr-ui/react |
| **Authentication** | Supabase Auth |
| **Database** | Supabase (PostgreSQL) |
| **Routing** | React Router DOM 7.13 |
| **Animations** | Motion (Framer Motion), Three.js |
| **3D/Graphics** | Three.js, OGL |

---

## Project Structure

```
verbose/
├── public/                    # Static assets
├── src/
│   ├── assets/               # Images and media
│   ├── components/
│   │   ├── AuthCallback.tsx  # OAuth callback handler
│   │   ├── DecryptedText.tsx # Animated text reveal component
│   │   ├── FloatingLines.tsx # Three.js shader background
│   │   ├── GlassSurface.tsx  # Glass-morphism container
│   │   ├── GooeyNav.tsx      # Particle navigation component
│   │   ├── HomePage.tsx      # Main dashboard after login
│   │   ├── LoginPage.tsx     # Authentication UI
│   │   ├── Logo.tsx          # Brand logo component
│   │   └── ProfileAvatar.tsx # User avatar with dropdown
│   ├── lib/
│   │   └── supabase.ts       # Supabase client & auth helpers
│   ├── providers/
│   │   ├── app.tsx           # UI theme provider
│   │   └── auth.tsx          # Authentication context
│   ├── App.tsx               # Main app component
│   ├── main.tsx              # Entry point with routing
│   └── index.css             # Global styles
├── supabase-schema.sql       # Database schema
├── .env.example              # Environment variables template
├── vite.config.ts            # Vite configuration
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/verbose.git
   cd verbose
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   
   Run the SQL schema in your Supabase SQL Editor:
   - Go to your Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `supabase-schema.sql`
   - Execute the query

5. **Start the development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

---

## Supabase Configuration

### 1. Enable Authentication Providers

Navigate to **Authentication → Providers** in your Supabase dashboard:

#### Email/Password
- Enabled by default

#### Anonymous Sign-in
1. Find **Anonymous Sign-In** in the providers list
2. Toggle **Enable Anonymous Sign-ins** to ON
3. Save

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URI:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
7. Copy the Client ID and Client Secret
8. In Supabase Dashboard → Authentication → Providers → Google:
   - Enable Google provider
   - Paste Client ID and Client Secret
   - Save

#### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: Verbose
   - **Homepage URL**: `http://localhost:5173` (or your production URL)
   - **Authorization callback URL**: `https://your-project-ref.supabase.co/auth/v1/callback`
4. Copy the Client ID and generate a Client Secret
5. In Supabase Dashboard → Authentication → Providers → GitHub:
   - Enable GitHub provider
   - Paste Client ID and Client Secret
   - Save

### 2. Configure Site URL

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `http://localhost:5173` (development) or your production URL
- **Redirect URLs**: Add both localhost and production URLs

---

## Database Schema

The app uses a `profiles` table to store user information:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Features:
- **Row Level Security (RLS)** — Users can only access their own profile
- **Auto-creation trigger** — Profile automatically created on user signup
- **Updated timestamp** — Automatically updates `updated_at` on changes

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## Component Overview

### FloatingLines
Interactive Three.js shader-based background with:
- Multiple wave layers (top, middle, bottom)
- Mouse interaction support
- Parallax scrolling
- Customizable line count, colors, and animation speed

### DecryptedText
Character-by-character text reveal animation:
# Verbose — current code snapshot

A modern, experimental real-time communication UI built with React + TypeScript and Supabase.

This README has been generated from the current workspace sources and highlights the
app behaviour, important files, runtime scripts, and Supabase configuration required
to run the project locally.

![React](https://img.shields.io/badge/React-19.1.1-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue) ![Supabase](https://img.shields.io/badge/Supabase-Auth-green) ![Vite](https://img.shields.io/badge/Vite-5.4-purple)

---

**Quick summary**
- Name: Verbose (UI reads `VERBOSE` in `src/components/Logo.tsx`)
- Primary entry: [src/main.tsx](src/main.tsx#L1)
- App root: [src/App.tsx](src/App.tsx#L1)
- Supabase client and auth helpers: [src/lib/supabase.ts](src/lib/supabase.ts#L1)

**What this repo contains**
- A landing / auth flow with animated backgrounds (Three/OGL shaders + fluid sim)
- Authentication via Supabase (email/password, Google, GitHub, anonymous)
- Demo UI pages: landing, login, and a simple home/dashboard
- Several visual components: `DecryptedText`, `Threads` (shader), `SplashCursor` (fluid), `Aurora`, `SpringSidebar` and `ProfileAvatar`.

---

**Table of contents**
- **Project layout**
- **Install & run**
- **Environment & Supabase setup**
- **Auth flow details**
- **Important components & behaviour**
- **Scripts**
- **Development notes**
- **Troubleshooting**
- **Contributing**

---

**Project layout (high level)**

```
verbose/
├─ public/                        # static assets
├─ src/
│  ├─ assets/                      # images and static media
│  ├─ components/                  # UI components & visual pieces
│  │  ├─ App.tsx                    # main app root (landing / auth / home)
│  │  ├─ HomePage.tsx               # authenticated dashboard UI
│  │  ├─ LoginPage.tsx              # sign in / sign up / guest UI
│  │  ├─ Threads.tsx                # shader-based animated lines (OGL)
│  │  ├─ SplashCursor.tsx           # fluid simulation background
│  │  ├─ DecryptedText.tsx          # scramble/reveal text animation
│  │  ├─ ProfileAvatar.tsx          # user menu + avatar
│  │  ├─ SpringSidebar.tsx          # landing scroll sidebar
│  │  ├─ Logo.tsx                   # brand label
│  │  └─ ...                        # other visual helpers
│  ├─ lib/
│  │  └─ supabase.ts                # supabase client + auth helper functions
│  ├─ providers/
│  │  ├─ app.tsx                    # UI provider & configuration
│  │  └─ auth.tsx                   # auth context + session handling
│  ├─ main.tsx                      # app bootstrap & route for auth callback
│  └─ index.css                     # global styles
├─ supabase-schema.sql              # suggested profile table schema
├─ vite.config.ts                   # Vite config
└─ package.json                     # scripts and dependencies
```

Files of special interest (quick links):
- [src/App.tsx](src/App.tsx#L1)
- [src/main.tsx](src/main.tsx#L1)
- [src/lib/supabase.ts](src/lib/supabase.ts#L1)
- [src/providers/auth.tsx](src/providers/auth.tsx#L1)
- [src/components/Threads.tsx](src/components/Threads.tsx#L1)
- [src/components/SplashCursor.tsx](src/components/SplashCursor.tsx#L1)
- [src/components/DecryptedText.tsx](src/components/DecryptedText.tsx#L1)

---

**Install & run (local)**

Prerequisites: Node.js 18+, npm (or pnpm).

Steps:

1. Install dependencies

```bash
npm install
```

2. Create a `.env` from your environment template and set Supabase keys (example variables expected by the code are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`). See `src/lib/supabase.ts` for runtime checks and validation.

3. Start dev server

```bash
npm run dev
```

The app mounts at `http://localhost:5173` by default.

---

**Environment & Supabase setup**

- The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` via `import.meta.env` in [src/lib/supabase.ts](src/lib/supabase.ts#L1). If either is missing a warning is printed and some auth flows will fail.
- OAuth callback route is handled by [src/components/AuthCallback.tsx](src/components/AuthCallback.tsx#L1) which exchanges the code and redirects to `/`.
- Recommended DB object: the repository includes a `supabase-schema.sql` that defines a `profiles` table. `auth.tsx` uses `getUserProfile` to fetch profile info.

Supabase providers to configure for full functionality:
- Email/password: on by default.
- Google and GitHub: for OAuth flows used in `src/lib/supabase.ts` (`signInWithGoogle`, `signInWithGitHub`).
- Anonymous sign-in: code calls `supabase.auth.signInAnonymously()` for guest sessions.

When configuring OAuth providers, ensure the redirect URI includes your Supabase auth callback URL (e.g. `https://<project-ref>.supabase.co/auth/v1/callback`).

---

**Auth flow details (implementation notes)**

- `src/providers/auth.tsx`:
  - Reads the initial session using `supabase.auth.getSession()` and subscribes to `onAuthStateChange`.
  - Provides helper methods to components: `signIn` (username + password via `signInWithUsername`), `signUp`, `signInGoogle`, `signInGitHub`, `signInAsAnonymous`, `signOut`, `resetPassword`, and `refreshProfile`.
  - Defensive measures: timeouts around authentication calls and session verification to avoid indefinite loading states.

- `src/lib/supabase.ts` exposes:
  - `signUpWithEmail`, `signInWithEmail`, `signInWithGoogle`, `signInWithGitHub`, `signInAnonymously`, `signInWithUsername` (looks up email via RPC `get_email_by_username`), `getUserProfile`, `updateUserProfile`, and `resetPassword`.

---

**Important components & behaviour**

- `Threads` (`src/components/Threads.tsx`): shader-driven lines using `ogl`. The fragment shader composes many lines with Perlin-like noise. The component resizes on window resize and supports optional mouse interaction.
- `SplashCursor` (`src/components/SplashCursor.tsx`): a WebGL fluid simulation used as animated background. It's a relatively large file implementing a GPU fluid solver and renderer.
- `DecryptedText` (`src/components/DecryptedText.tsx`): a utility that scrambles and reveals text either on hover or when it comes into view.
- `LoginPage` (`src/components/LoginPage.tsx`): handles sign in / sign up / guest flows with form validation and OAuth buttons.
- `HomePage` (`src/components/HomePage.tsx`): lightweight dashboard that shows different UI for anonymous vs authenticated users (locks audio/video features for guests).

---

**Scripts (from package.json)**

- `npm run dev` — start Vite dev server
- `npm run build` — build (runs `tsc -b` then `vite build`)
- `npm run preview` — preview production build
- `npm run lint` — run ESLint

See `package.json` for the exact versions and dependencies used.

---

**Developer notes & recommendations**

- Performance: the shader and fluid simulation are GPU-heavy; the code disables heavy backgrounds on mobile (`isMobile` checks in `App.tsx` and `LoginPage.tsx`). Reduce shader complexity or element counts for lower-end devices.
- Auth robustness: `auth.tsx` includes timeouts and extra verification to avoid stale sessions; when debugging auth issues, check browser console and Supabase dashboard logs.
- Username->email lookup: `signInWithUsername` uses an RPC `get_email_by_username` — if you use this feature, ensure the corresponding database function exists in your Supabase DB.

---

**Troubleshooting (quick)**

- "Missing Supabase keys" — ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.
- OAuth redirect mismatch — confirm redirect URIs in Google/GitHub match your Supabase callback URL.
- Fluid shader/GL errors — test with a modern browser and enable WebGL2; `SplashCursor` falls back on reduced features when extensions are missing.

---

**Contributing**

If you'd like to contribute:
1. Fork and branch
2. Run the app locally and add tests or examples
3. Open a PR with a short description of the change

---

**License**

MIT


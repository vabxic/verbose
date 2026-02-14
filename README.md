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
- Configurable speed and direction
- Supports hover and view-triggered animations
- Scrambles through random characters before revealing

### GooeyNav
Navigation component with fluid particle effects:
- Animated selection indicator
- Configurable particle count and colors
- Smooth SVG filter-based blur effect

### ProfileAvatar
User profile component showing:
- OAuth provider avatar (Google/GitHub)
- Letter fallback for email users
- Guest icon for anonymous users
- Dropdown menu with user info and sign out

### LoginPage
Full authentication UI with:
- Tab-based navigation (Sign In / Sign Up / Guest)
- Form validation
- OAuth buttons for Google and GitHub
- Error handling and loading states

### HomePage
Main dashboard after authentication:
- Welcome card with user name
- Feature cards for Chat, Voice Call, Video Call, Find People, Settings
- Guest users see locked indicators on premium features
- Upgrade prompts for anonymous users

---

## Customization

### Theme Colors
The app uses a dark theme with purple/blue accents. Main colors are defined in CSS:
- Primary gradient: `#7c5bff` → `#a78bfa`
- Background: Dark with glass-morphism overlays
- Text: White with varying opacity levels

### FloatingLines Options
```tsx
<FloatingLines
  enabledWaves={["top", "middle", "bottom"]}
  lineCount={5}
  lineDistance={5}
  bendRadius={5}
  bendStrength={-0.5}
  interactive={true}
  parallax={true}
  mixBlendMode="screen"
/>
```

### DecryptedText Options
```tsx
<DecryptedText
  text="Your text here"
  speed={50}
  maxIterations={12}
  sequential={true}
  revealDirection="start"
  animateOn="view"
/>
```

### GooeyNav Options
```tsx
<GooeyNav
  items={[
    { label: "Home", href: "#" },
    { label: "Docs", href: "#" },
    { label: "Contact", href: "#" },
  ]}
  animationTime={600}
  particleCount={15}
/>
```

---

## Deployment

### Build for Production
```bash
npm run build
```

The output will be in the `dist/` directory.

### Environment Variables
Ensure these are set in your production environment:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Update OAuth Redirect URLs
Add your production domain to:
1. Google Cloud Console → OAuth client → Authorized redirect URIs
2. GitHub OAuth App → Authorization callback URL
3. Supabase → Authentication → URL Configuration → Redirect URLs

### Hosting Providers
Deploy the `dist` folder to any static hosting:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

---

## Troubleshooting

### Common Issues

**"Anonymous sign-ins are disabled"**
- Enable Anonymous Sign-in in Supabase → Authentication → Providers

**"redirect_uri_mismatch" on OAuth**
- Ensure the redirect URI in your OAuth provider matches exactly:
  `https://your-project-ref.supabase.co/auth/v1/callback`

**DNS errors / NXDOMAIN**
- Check that `VITE_SUPABASE_URL` has the correct project reference ID
- Verify the URL is accessible: `nslookup your-project-ref.supabase.co`

**Stuck on loading after user deletion**
- The app handles this automatically by detecting deleted users and signing out

**Background causes performance issues**
- The FloatingLines shader is memoized to prevent re-renders
- Reduce `lineCount` for better performance on low-end devices

---

## License

MIT License — feel free to use this project as a starting point for your own applications.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request


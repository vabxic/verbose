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

### Communication
- **Real-time Chat** — WebSocket-based messaging in rooms
- **Voice/Video Calls** — WebRTC signaling with audio/video streaming
- **File Sharing** — Direct upload to user's cloud storage (zero platform storage) or Supabase Storage
- **Room Drive** — Shared file storage with thumbnails and inline preview

### Cloud Storage (User-Owned)
- **Google Drive Integration** — Files upload directly to user's personal Google Drive
- **Zero Platform Storage** — Verbose servers never store files; only metadata and public share links
- **OAuth2 Flow** — Secure token-based authentication
- **Resumable Uploads** — Large file support (up to Google Drive limits)
- **Shared Links** — Public download URLs for room participants
- **Fallback Storage** — Supabase Storage available when no cloud is connected
- **Cloud Badge** — Visual indicator of cloud-hosted files
- **Multi-Provider Ready** — Architecture supports Dropbox/OneDrive (future)

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
- **Cloud Storage** — Connected users' files stored in their personal cloud

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
| **Cloud Storage** | Google Drive API, Supabase Storage |
| **Routing** | React Router DOM 7.13 |
| **Animations** | Motion (Framer Motion), Three.js |
| **3D/Graphics** | Three.js, OGL |
| **WebRTC** | Peer connections for calls |
| **Realtime** | Supabase Realtime subscriptions |

---

## Project Structure

```
verbose/
├── public/                          # Static assets
├── src/
│   ├── assets/                      # Images and media
│   ├── components/
│   │   ├── AuthCallback.tsx         # OAuth callback handler
│   │   ├── ChatRoom.tsx             # Real-time chat & WebRTC calls
│   │   ├── CloudStorageSettings.tsx # Google Drive OAuth connection UI
│   │   ├── DecryptedText.tsx        # Animated text reveal component
│   │   ├── GoogleDriveCallback.tsx  # Google Drive OAuth popup callback
│   │   ├── HomePage.tsx             # Main dashboard after login
│   │   ├── LoginPage.tsx            # Authentication UI
│   │   ├── Logo.tsx                 # Brand logo component
│   │   ├── ProfileAvatar.tsx        # User avatar with dropdown
│   │   ├── RoomDrive.tsx            # Shared file storage UI with cloud status
│   │   └── SpringSidebar.tsx        # Landing scroll sidebar
│   ├── lib/
│   │   ├── supabase.ts              # Supabase client & auth helpers
│   │   ├── rooms.ts                 # Room management & messaging
│   │   ├── drive.ts                 # File upload/download (dual-path cloud/supabase)
│   │   ├── cloud-storage.ts         # Google Drive provider & OAuth flow
│   │   ├── social.ts                # Social features (friend requests, saved rooms)
│   │   └── webrtc.ts                # WebRTC signaling & peer connections
│   ├── providers/
│   │   ├── app.tsx                  # UI theme provider
│   │   └── auth.tsx                 # Authentication context
│   ├── App.tsx                      # Main app component
│   ├── main.tsx                     # Entry point with routing
│   └── index.css                    # Global styles
├── supabase-schema.sql              # Profile & auth schema
├── supabase-schema-chat.sql         # Rooms, messages, WebRTC signals
├── supabase-schema-drive.sql        # File metadata & storage bucket setup
├── supabase-schema-cloud-storage.sql# Google Drive OAuth tokens & cloud columns
├── supabase-schema-social.sql       # Friends, saved rooms, social features
├── .env.example                     # Environment variables template
├── vite.config.ts                   # Vite configuration
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
   VITE_GOOGLE_DRIVE_CLIENT_ID=your_google_drive_client_id
   ```

4. **Set up the database**
   
   Run the SQL schemas in your Supabase SQL Editor in order:
   - Go to your Supabase Dashboard → SQL Editor
   - Execute each schema file in order:
     1. `supabase-schema.sql` (profiles & auth)
     2. `supabase-schema-chat.sql` (rooms & messaging)
     3. `supabase-schema-drive.sql` (file metadata)
     4. `supabase-schema-cloud-storage.sql` (Google Drive integration)
     5. `supabase-schema-social.sql` (social features)

5. **Configure Google Drive OAuth** (optional, but required for cloud storage)
   
   See the **Google Drive Cloud Storage Setup** section below.

6. **Start the development server**
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

## Google Drive Cloud Storage Setup

Verbose supports **user-owned cloud storage** via Google Drive. Files upload directly from the browser to users' personal Google Drive accounts—zero files stored on Verbose servers.

### Overview

- **User connects** → Authorizes Verbose to access their Google Drive
- **User uploads files** → Files go directly to their Drive → public share link created
- **Other users download** → Direct download from the share link (zero platform storage)
- **User disconnects** → Existing share links remain valid; user reclaims full control

### Setup Steps

#### 1. Create Google OAuth2 Application

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services → Credentials**
4. Click **+ Create Credentials → OAuth client ID**
5. Select **Web application**
6. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (local development)
   - `https://your-app.vercel.app` (production Vercel URL)

7. Under **Authorized redirect URIs**, add:
   - `http://localhost:5173/auth/google-drive/callback`
   - `https://your-app.vercel.app/auth/google-drive/callback`

8. Click **Create** and copy the **Client ID**

#### 2. Enable Google Drive API

1. In Google Cloud Console, go to **APIs & Services → Library**
2. Search for **"Google Drive API"**
3. Click it and press **Enable**
4. Search for **"Google People API"**  
5. Click it and press **Enable**

#### 3. Add to .env

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=your_client_id_from_step_1
```

#### 4. Deploy to Vercel (if production)

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add:
   ```
   VITE_GOOGLE_DRIVE_CLIENT_ID=your_client_id
   ```
3. Redeploy your project

### Usage

**Sender (uploads file):**
1. Open Room Drive in any room
2. Click **"Connect cloud storage"** (or shows connected email if already connected)
3. Authorize Google Drive when prompted
4. A `Verbose` folder is automatically created in your Drive
5. Upload a file → it goes directly to your Drive
6. A public share link is created and stored in the Verbose DB

**Receiver (downloads file):**
1. In Room Drive, see the uploaded file with a ☁ cloud badge
2. Click **View** (for images/video/audio) or **Download**
3. File streams directly from the uploader's Google Drive

### How it Works (Architecture)

**[src/lib/cloud-storage.ts](src/lib/cloud-storage.ts)** implements:
- OAuth2 implicit grant flow (popup-based)
- Google Drive multipart upload (small files) and resumable upload with progress (large files)
- Public file sharing (https://www.googleapis.com/drive/v3/files/permissions)
- Token refresh handling

**[src/lib/drive.ts](src/lib/drive.ts)** routes file operations:
- Check if user has connected cloud storage
- If yes → upload to Google Drive via cloud-storage.ts
- If no → fallback to Supabase Storage

**Database columns** ([supabase-schema-cloud-storage.sql](supabase-schema-cloud-storage.sql)):
- `user_cloud_settings` table: stores OAuth tokens, folder IDs, provider email
- `room_files.cloud_provider`, `cloud_file_id`, `cloud_share_url`: metadata for cloud-hosted files

### Security & Privacy

- **Tokens stored in Supabase DB** — for production, encrypt at rest using Supabase Vault
- **Public share links** — anyone with the link can download (requires file sharer to accept this)
- **User pays Google Drive costs** — 15 GB free tier; additional storage is user's responsibility
- **RLS on settings table** — each user can only access their own stored tokens
- **No file data on Verbose** — only metadata (filename, size, MIME type, provider, share URL)

### Roadmap

- Dropbox support (infrastructure ready, OAuth2 handler stub exists)
- OneDrive support (infrastructure ready, OAuth2 handler stub exists)
- Token refresh automation (currently manual re-auth on expiry)
- Server-side presigned URL generation (for enhanced security)

---

## Database Schema

The app uses multiple tables for authentication, messaging, files, and cloud storage:

### Profiles Table
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

### Cloud Settings Table
```sql
CREATE TABLE public.user_cloud_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'google_drive' | 'dropbox' | 'onedrive'
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  provider_email TEXT,
  folder_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Features:
- **Per-user cloud provider** — Each user can connect one cloud provider at a time
- **Token management** — Expiry tracking and refresh handling
- **Folder isolation** — Each Verbose app gets its own folder in user's cloud

---

## Scripts & Database Setup

### NPM Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server on http://localhost:5173 |
| `npm run build` | Build optimized production bundle |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint on src/ directory |

### Database Setup (Supabase)

After cloning the repo, initialize your Supabase database by running these SQL scripts **in order** via the Supabase SQL Editor:

1. **[supabase-schema.sql](supabase-schema.sql)** — Core tables (auth, profiles, messages, sessions)
2. **[supabase-schema-chat.sql](supabase-schema-chat.sql)** — Chat room, messages, and replications
3. **[supabase-schema-drive.sql](supabase-schema-drive.sql)** — File storage and room_files
4. **[supabase-schema-cloud-storage.sql](supabase-schema-cloud-storage.sql)** — User cloud settings and cloud file metadata
5. **[supabase-schema-social.sql](supabase-schema-social.sql)** — Social features (links, profiles)

**Why order matters:** Each schema file references tables from previous files. Running out of order will cause foreign key errors.

### Cloud Storage Setup

To enable Google Drive integration:

1. Complete the **[Google Drive Cloud Storage Setup](#google-drive-cloud-storage-setup)** section above
2. Add `VITE_GOOGLE_DRIVE_CLIENT_ID` to your `.env` file
3. (Optional) For production Vercel deployment, add the same variable to Vercel project settings

See [CLOUD_STORAGE_SETUP.md](CLOUD_STORAGE_SETUP.md) for troubleshooting and advanced configuration.


---

## Contributing

If you'd like to contribute:
1. Fork and branch
2. Run the app locally and add tests or examples
3. Open a PR with a short description of the change

---

## License

MIT



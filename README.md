# SONORA — AI Music Studio

An AI-powered music production platform. Describe the music you want, and Sonora composes it for you.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Auth & Database**: Supabase (Postgres + Auth + Storage)
- **Music Generation**: Replicate (Meta MusicGen)
- **Creative AI**: Anthropic Claude (lyrics, titles, remix suggestions)

## Getting Started

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Replicate](https://replicate.com) API token
- An [Anthropic](https://console.anthropic.com) API key

### 2. Install

```bash
git clone <your-repo-url> sonora
cd sonora
npm install
```

### 3. Environment Variables

```bash
cp .env.example .env.local
```

Fill in your keys in `.env.local`.

### 4. Database Setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor to create the tables, RLS policies, and storage bucket.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
User prompt
  │
  ├──► /api/metadata  (Claude) → title, lyrics, description, tags
  │
  └──► /api/generate  (Replicate MusicGen) → audio file
          │
          └──► Supabase Storage (audio)
               Supabase Postgres (track metadata)
```

### Key API Routes

| Route            | Purpose                                      |
|------------------|----------------------------------------------|
| `/api/generate`  | Sends prompt to Replicate, stores audio       |
| `/api/metadata`  | Claude generates title, lyrics, tags          |
| `/api/remix`     | Creates variation of existing track           |
| `/api/share`     | Generates shareable link for a track          |

## Features

- [x] Text-to-song generation
- [x] AI-generated lyrics & metadata
- [x] Song variations & remixing
- [x] User accounts & saved library
- [x] Shareable track links
- [ ] Collaborative playlists
- [ ] Mobile app (React Native)

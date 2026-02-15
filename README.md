# UnfoldYou

> **"Express anonymously. Connect psychologically. Unfold authentically."**

UnfoldYou is a privacy-first social platform designed to foster genuine connections through a progressive reveal system. Users start as anonymous "Shadow Profiles" and gradually reveal their true selves as trust is built through meaningful conversation.

## 🚀 Features

### Core Experience
-   **Anonymous First**: Interactions begin with "Shadow Profiles" (avatars + pseudonyms).
-   **POV Cards**: Share thoughts, feelings, and questions anonymously on a public feed.
-   **Psychological Matching**: Onboarding includes "Love Soul" questions based on attachment theory and love languages.

### Connection & Chat
-   **Progressive Reveal System**:
    -   🎭 **Shadow**: Basic anonymous profile.
    -   🤫 **Whisper**: Unlock voice notes after 25 messages.
    -   👁️ **Glimpse**: Unlock habits & intent after 50 messages + 3 days.
    -   💫 **Soul**: Unlock deep psychology answers after 100 messages + 7 days.
    -   🦋 **Unfold**: Mutual agreement to reveal real identity.
-   **Dual Flows**:
    -   **Stranger**: Discover via Feed/Search.
    -   **Known**: Connect via 6-digit code sharing.

### Polish & Safety (Phase 4)
-   **Real-time Notifications**: Alerts for likes, messages, and connection requests.
-   **Safety Tools**: Block/Report users, content moderation.
-   **Rate Limiting**: Protection against spam (e.g., max 5 POVs/hour).
-   **Social Sharing**: Dynamic OpenGraph images for sharing POV cards to other platforms.

## 🛠️ Tech Stack

-   **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Actions)
-   **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
-   **Auth**: Supabase Auth (Passwordless Email OTP)
-   **Realtime**: Supabase Realtime (Chat & Notifications)
-   **Styling**: Vanilla CSS Modules (NeoBrutalism design system)
-   **Deployment**: Vercel

## 📂 Project Structure

```
unfoldyou/
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── (app)/          # Protected routes (Feed, Chat, Profile)
│   │   ├── (auth)/         # Public auth routes (Login, Verify)
│   │   ├── pov/[id]/       # Public POV card page
│   │   └── page.tsx        # Splash component
│   ├── components/         # Reusable UI components
│   │   ├── notifications/  # Notification system
│   │   ├── safety/         # Report/Block modals
│   │   └── ...
│   ├── lib/                # Utilities and core logic
│   │   ├── actions/        # Server Actions (Mutations)
│   │   ├── hooks/          # Custom React Hooks
│   │   ├── supabase/       # Clients (Server, Client, Admin)
│   │   └── ...
│   └── styles/             # Global CSS variables & design tokens
├── supabase/               # SQL migrations and schema
└── public/                 # Static assets
```

## ⚡ Getting Started

### Prerequisites
-   Node.js 18+
-   Supabase Project

### Environment Variables
Create a `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Installation
```bash
npm install
npm run dev
```

### Database Setup
Run the SQL scripts located in `supabase/` in your Supabase SQL Editor in the following order:
1.  `schema.sql` (Base tables & RLS)
2.  `phase4.sql` (Notifications & Safety)

## 🎨 Design System
**NeoBrutalism**: High contrast, bold borders, vibrant colors, and playful typography.
-   **Tokens**: Defined in `src/app/globals.css`.
-   **Colors**: Ink (`#0F0F1A`), Paper (`#F4F4F5`), Ember (`#E85D3A`), Honey (`#F5A623`), Sage (`#4A6FA5`).

## 📜 License
Private & Confidential.

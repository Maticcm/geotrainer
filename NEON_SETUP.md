# GeoTrainer — Neon PostgreSQL & Neon Auth Setup Guide

This guide walks you through setting up **Neon Serverless Postgres** and **Neon Auth** for GeoTrainer. GeoTrainer uses Neon Auth for identity and session management, and Neon PostgreSQL (via Drizzle ORM) for cloud progress persistence and cross-device synchronization.

---

## 1. Create a Neon Project

1. Log in to [Neon Console](https://console.neon.tech).
2. Click **Create Project**.
3. Name your project (e.g. `geotrainer-db`).
4. Select your preferred cloud provider and region (e.g., `AWS` / `Frankfurt (eu-central-1)`).
5. Choose PostgreSQL version `16` or `17`.
6. Click **Create Project**.

---

## 2. Configure Database Connection

1. In the Neon Console dashboard for your project, locate **Connection Details**.
2. Select **Connection pooling** for serverless scaling.
3. Copy the connection string. It will look like:
   ```
   postgresql://[user]:[password]@[endpoint-id]-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Copy `.env.example` to `.env.local` in the project root:
   ```bash
   cp .env.example .env.local
   ```
5. Paste your connection string into `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:password@ep-sample-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
   ```

---

## 3. Enable Neon Auth

1. In your Neon Console project navigation, click the **Auth** tab.
2. Click **Enable Auth**.
3. Neon Auth provisions a managed authentication service (built on Better Auth) with authentication tables stored in your PostgreSQL database under the `neon_auth` schema.
4. Copy the **Auth Base URL** shown in the Auth tab:
   ```env
   NEON_AUTH_BASE_URL="https://auth.neon.tech/v1/projects/[project-id]"
   ```
5. Generate a secure 32+ character cookie secret for signing session cookies:
   ```bash
   # On macOS/Linux/Git Bash:
   openssl rand -base64 32
   ```
   Add it to `.env.local`:
   ```env
   NEON_AUTH_COOKIE_SECRET="your-generated-random-32-byte-secret"
   ```
6. Set the application URL for local development:
   ```env
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

---

## 4. Configure Authentication Methods and Redirect URLs

1. In **Neon Auth Settings**:
   - Enable **Email & Password**.
   - Under **Allowed Redirect URLs**, add:
     - `http://localhost:3000`
     - `http://localhost:3000/api/auth/callback/*`
     - `http://localhost:3000/reset-password`
     - Your production URL when deployed (e.g., `https://geotrainer.app`).

---

## 5. Setting up Email Verification and Password Recovery

1. In the **Email Settings** section of the Neon Auth tab:
   - Configure your email sender (or use Neon's built-in development mail delivery for test environments).
   - Set the Password Reset redirect URL to:
     ```
     http://localhost:3000/reset-password
     ```
   - GeoTrainer provides complete dedicated UI flows for:
     - `/forgot-password` (requests reset link)
     - `/reset-password` (accepts token and updates password)

---

## 6. Optional Google OAuth Setup

1. In Google Cloud Console:
   - Create an OAuth 2.0 Web Application credential.
   - Set the Authorized Redirect URI to your Neon Auth callback URL:
     `https://auth.neon.tech/v1/projects/[project-id]/callback/google`
2. In the Neon Auth dashboard, toggle **Google** under **Social Providers**.
3. Paste the **Client ID** and **Client Secret**.
4. In `.env.local`, set:
   ```env
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```
   *Note: Email/password authentication works completely independently without Google OAuth configured.*

---

## 7. Generating and Applying Database Migrations

GeoTrainer uses **Drizzle ORM** with version-controlled migrations located in `drizzle/`.

1. To generate migration files when schema changes are made:
   ```bash
   npm run db:generate
   ```
2. To push schema changes directly to Neon:
   ```bash
   npm run db:push
   ```
3. To apply migrations programmatically:
   ```bash
   npm run db:migrate
   ```

### Schema Overview
- `profiles`: Connected to the Neon Auth user ID (`id` matches `neon_auth.user.id`). Stores `displayName`, `avatarUrl`, `createdAt`, `updatedAt`.
- `user_progress`: Composite primary key on `(user_id, feature_id)`. Tracks SRS spaced-repetition intervals, mastery levels, accuracy, and streaks.
- `game_sessions`: Session history (mode, category, score, questions answered, timestamp).
- `game_answers`: Individual answer logs with response time and accuracy for granular analytics.

---

## 8. Running the Application Locally

```bash
# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 9. Testing the Full Registration-to-Progress-Sync Workflow

1. **Anonymous Play**: Open GeoTrainer in an incognito window without logging in. Play a round in `/play/locate`. Notice answers and mastery update locally.
2. **Sign Up**: Navigate to `/signup` and create an account with email and password.
3. **Automatic Profile Creation**: Neon Auth creates the authenticated user, and GeoTrainer establishes the user profile row.
4. **Local-to-Cloud Migration**:
   - Go to `/settings/account`.
   - GeoTrainer detects the anonymous progress accumulated on this device.
   - Click **Uvozi zdaj** (Import Now) to deterministically merge local counters and SRS schedules to your Neon PostgreSQL account.
5. **Real-Time Sync**:
   - Play another quiz round. GeoTrainer streams each answer and completed session directly to Neon PostgreSQL.
   - In `/settings/account`, the status badge shows `Sinhronizirano` (Synced) with live cloud statistics.
6. **Cross-Device Persistence**:
   - Log out, clear local storage or open another browser, and log back in.
   - Your full progress, review schedule, and history are restored from Neon Cloud!

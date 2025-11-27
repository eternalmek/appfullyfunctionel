# EternalMe — Full Stack Application

This repository provides a complete full-stack implementation for the EternalMe application, consisting of:

## Project Structure

- `/src` - Backend (Node.js + Express)
- `/frontend` - Frontend (React + Vite + Tailwind CSS)
- `/prisma` - Database schema and migrations

## Backend Features

- Email/password auth with JWT + refresh tokens
- OAuth endpoints for Facebook/Instagram, TikTok, and Google Photos
- Memory CRUD (create, read, update, delete)
- Likes and comments (with realtime socket notifications)
- File upload to S3
- **AI Mirror assistant** - Powered by OpenAI with intelligent fallback responses
- Prisma ORM (Postgres/Supabase) with seed script
- Socket.io for realtime events
- Email helper (nodemailer) for future verification/reset

## Frontend Features

- React 19 with Vite for fast development
- Tailwind CSS for styling
- Clean API-based architecture (all data via backend)
- Authentication (email/password + social login)
- Memory feed with list/grid views
- AI Mirror assistant chat interface
- Analytics/Insights dashboard
- Data source connections management
- Responsive design (mobile + desktop)
- Ready for Vercel deployment

## Quick Setup

### Backend Setup

1. Copy `.env.example` -> `.env` and fill values:
   ```
   DATABASE_URL=your-postgres-connection-string
   JWT_SECRET=your-secret
   OPENAI_API_KEY=optional-but-recommended-for-ai-features
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Generate Prisma client and run migrations:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. Seed demo data:
   ```bash
   npm run seed
   ```

5. Run backend in dev:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` -> `.env` and fill values:
   ```
   VITE_API_URL=http://localhost:4000
   ```

4. Run frontend in dev:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Deploying to Vercel

### Frontend Deployment

1. Push the repository to GitHub
2. Connect your repository to Vercel
3. Set the root directory to `frontend`
4. Add environment variables:
   - `VITE_API_URL` (your backend URL)
5. Deploy!

### Backend Deployment (Vercel Functions or separate hosting)

The backend can be deployed to:
- Vercel Functions (serverless)
- Railway
- Render
- Any Node.js hosting

## Database Setup (PostgreSQL/Supabase)

You can use any PostgreSQL database. Supabase is recommended for easy setup:

1. Create a Supabase project at https://supabase.com
2. Get your database connection string from Project Settings -> Database
3. Use the connection string as `DATABASE_URL` in your backend `.env` file
4. Run Prisma migrations: `npx prisma migrate dev`

**Note:** The frontend does not need Supabase credentials - it communicates only with the backend API.

## Enabling AI Features (OpenAI)

For full AI Mirror capabilities, add your OpenAI API key to the backend `.env`:

```
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini  # optional, defaults to gpt-4o-mini
```

Without an OpenAI API key, the Mirror will use intelligent fallback responses that can still help users navigate the app.

## Enabling Social Media Connections

To enable real OAuth connections with social media platforms, you need to register your app with each provider and add the credentials to your backend `.env`:

### Facebook/Instagram
Register at: https://developers.facebook.com/apps/
```
OAUTH_FACEBOOK_CLIENT_ID=your-facebook-app-id
OAUTH_FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
OAUTH_FACEBOOK_CALLBACK_URL=https://your-backend.com/connections/facebook/callback
OAUTH_FACEBOOK_LOGIN_CALLBACK_URL=https://your-backend.com/auth/oauth/facebook/callback
OAUTH_INSTAGRAM_CALLBACK_URL=https://your-backend.com/connections/instagram/callback
OAUTH_INSTAGRAM_LOGIN_CALLBACK_URL=https://your-backend.com/auth/oauth/instagram/callback
```

### TikTok
Register at: https://developers.tiktok.com/
```
OAUTH_TIKTOK_CLIENT_ID=your-tiktok-client-key
OAUTH_TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
OAUTH_TIKTOK_CALLBACK_URL=https://your-backend.com/connections/tiktok/callback
OAUTH_TIKTOK_LOGIN_CALLBACK_URL=https://your-backend.com/auth/oauth/tiktok/callback
```

### Google Photos
Register at: https://console.cloud.google.com/apis/credentials
```
OAUTH_GOOGLE_CLIENT_ID=your-google-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_GOOGLE_CALLBACK_URL=https://your-backend.com/connections/photos/callback
```

**Note:** There are two types of OAuth callbacks:
- **Login callbacks** (`/auth/oauth/:provider/callback`) - Used for signing in/up with social accounts
- **Connection callbacks** (`/connections/:provider/callback`) - Used for connecting accounts to import media after login

Without OAuth credentials, the app runs in **demo mode** where connections are simulated locally.

## API Summary

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout (revoke refresh token)
- `GET /auth/me` - Get current user
- `GET /auth/oauth/config` - Get OAuth provider configuration status
- `POST /auth/oauth/:provider/init` - Initialize OAuth login flow
- `GET /auth/oauth/:provider/callback` - OAuth login callback

### Memories
- `GET /memories` - List memories (public)
- `POST /memories` - Create memory (auth required)
- `PUT /memories/:id` - Update memory (owner only)
- `DELETE /memories/:id` - Delete memory (owner only)
- `POST /memories/:id/like` - Like a memory
- `POST /memories/:id/unlike` - Unlike a memory
- `GET /memories/:id/comments` - Get comments
- `POST /memories/:id/comments` - Add comment

### Connections
- `GET /connections` - Get user's connected apps
- `POST /connections/:appId/toggle` - Toggle connection

### Mirror AI
- `POST /mirror/message` - Send message to AI assistant

### Upload
- `POST /upload` - Upload file (multipart/form-data)

## Important Notes

- This is a starter implementation
- Do NOT use in production without:
  - Auditing security
  - Locking down secrets
  - Enabling HTTPS
  - Running security reviews
- OAuth flows require registering apps with providers
- Encrypt tokens at rest in production
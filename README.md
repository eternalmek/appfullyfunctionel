# EternalMe — Full Stack Application

This repository provides a complete full-stack implementation for the EternalMe application, consisting of:

## Project Structure

- `/src` - Backend (Node.js + Express)
- `/frontend` - Frontend (React + Vite + Tailwind CSS)
- `/prisma` - Database schema and migrations

## Backend Features

- Email/password auth with JWT + refresh tokens
- OAuth starter endpoints for Facebook/Instagram and TikTok
- Memory CRUD (create, read, update, delete)
- Likes and comments (with realtime socket notifications)
- File upload to S3
- Mirror assistant integrated with OpenAI (if API key provided)
- Prisma ORM (Postgres/Supabase) with seed script
- Socket.io for realtime events
- Email helper (nodemailer) for future verification/reset

## Frontend Features

- React 19 with Vite for fast development
- Tailwind CSS for styling
- Supabase client integration for database
- Authentication (email/password + social login simulation)
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
   DATABASE_URL=your-supabase-postgres-url
   JWT_SECRET=your-secret
   OPENAI_API_KEY=optional-for-mirror
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
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
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
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (your backend URL)
5. Deploy!

### Backend Deployment (Vercel Functions or separate hosting)

The backend can be deployed to:
- Vercel Functions (serverless)
- Railway
- Render
- Any Node.js hosting

## Connecting to Supabase

1. Create a Supabase project at https://supabase.com
2. Get your database connection string from Project Settings -> Database
3. Get your API URL and anon key from Project Settings -> API
4. Use the connection string as `DATABASE_URL` in backend
5. Use the API URL and anon key in frontend environment variables

## API Summary

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout (revoke refresh token)
- `GET /auth/me` - Get current user

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
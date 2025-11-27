```markdown
# EternalMe Backend — Full Implementation (starter)

This repository provides a complete backend for the EternalMe React frontend. It includes:

- Email/password auth with JWT + refresh tokens
- OAuth starter endpoints for Facebook/Instagram and TikTok (you must register apps & set env)
- Memory CRUD (create, read, update, delete)
- Likes and comments (with realtime socket notifications)
- File upload to S3
- Mirror assistant integrated with OpenAI (if API key provided)
- Prisma ORM (Postgres) with seed script
- Socket.io for realtime events
- Email helper (nodemailer) for future verification/reset

Important: This is a starter implementation. Do NOT use in production without auditing, locking down secrets, enabling HTTPS, and running security reviews.

Quick setup

1. Copy .env.example -> .env and fill values (DATABASE_URL, JWT_SECRET, AWS keys, OPENAI_API_KEY, SMTP, OAuth credentials).

2. Install dependencies:
   ```
   npm install
   ```

3. Generate Prisma client and run migrations:
   ```
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. Seed demo data:
   ```
   npm run seed
   ```

5. Run in dev:
   ```
   npm run dev
   ```

APIs (summary)

- POST /auth/register {email, password, name}
  - returns { accessToken, refreshToken, user }

- POST /auth/login {email, password}
  - returns { accessToken, refreshToken, user }

- POST /auth/refresh { refreshToken }
  - returns { accessToken, refreshToken }

- POST /auth/logout { refreshToken }

- GET /auth/me
  - (Bearer token) returns current user

- GET /memories?limit&page&search
  - public listing; includes user relation

- POST /memories (Bearer)
  - create memory

- PUT /memories/:id (Bearer)
  - update (owner)

- DELETE /memories/:id (Bearer)
  - delete (owner)

- POST /memories/:id/like (Bearer)
- POST /memories/:id/unlike (Bearer)

- GET /memories/:id/comments
- POST /memories/:id/comments (Bearer)

- GET /connections (Bearer)
- POST /connections/:appId/toggle (Bearer)
- GET /connections/:appId/connect (Bearer) -> initiates provider OAuth redirect
- GET /connections/:appId/callback -> provider callback (must match registered redirect URI)

- POST /upload (Bearer, multipart/form-data, field "file")
  - uploads to S3 and creates memory

- POST /mirror/message (Bearer) { message }
  - uses OpenAI when configured, otherwise fallback

Realtime
- Socket.io server is initialized on the same server. From frontend, connect and join room `user:<userId>` to receive events:
  - memory:liked
  - memory:comment

Notes & next steps
- OAuth flows require registering apps and setting callback URIs.
- Provider token handling in this code stores tokens plainly — in production encrypt tokens at rest.
- Add input validation & stricter error handling where needed.
- Consider adding pagination metadata and rate limiting.
- Implement email verification and password reset flows using the included email helper.

If you want, I can now:
- Push these files to your repository feature branch and open a PR, or
- Generate the client-side changes to wire the React app to these endpoints.
Which would you like next?
```
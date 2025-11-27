# GitHub Copilot Instructions for EternalMe

This document provides guidelines for GitHub Copilot when working with the EternalMe full-stack application.

## Project Overview

EternalMe is a full-stack memory-sharing application consisting of:

- **Backend** (`/src`): Node.js + Express API server
- **Frontend** (`/frontend`): React 19 + Vite + Tailwind CSS
- **Database** (`/prisma`): Prisma ORM with PostgreSQL

## Technology Stack

### Backend
- Node.js with Express.js
- Prisma ORM for database operations
- PostgreSQL (or Supabase) as the database
- JWT for authentication with refresh tokens
- Socket.io for real-time features
- OpenAI API for AI Mirror assistant
- AWS S3 for file uploads
- Nodemailer for email functionality

### Frontend
- React 19 with functional components and hooks
- Vite for build tooling
- Tailwind CSS for styling
- Lucide React for icons
- ESLint for code linting

## Coding Conventions

### General
- Use ES6+ JavaScript syntax
- Prefer `const` over `let`, avoid `var`
- Use async/await for asynchronous operations
- Handle errors with try/catch blocks
- Use meaningful variable and function names

### Backend Conventions

#### File Structure
```
src/
├── index.js          # Main entry point
├── routes/           # Express route handlers
├── middleware/       # Custom middleware
├── utils/            # Utility functions
├── db.js             # Legacy database helper
├── prismaClient.js   # Prisma client instance
└── socket.js         # Socket.io configuration
```

#### Route Handlers
- Use Express Router for modular routes
- Apply middleware for authentication where needed
- Use express-validator for request validation
- Return consistent JSON responses:
  ```javascript
  res.json({ success: true, data: result });
  res.status(400).json({ success: false, error: 'Error message' });
  ```

#### Authentication
- Use JWT tokens with short expiry for access tokens
- Implement refresh token rotation
- Hash passwords with bcryptjs
- Protect routes with auth middleware

#### Database Operations
- Use Prisma client for all database operations
- Always handle database errors gracefully
- Use transactions for related operations
- Include only necessary fields in queries

### Frontend Conventions

#### File Structure
```
frontend/src/
├── App.jsx           # Main application component
├── components/       # Reusable React components
├── pages/            # Page-level components
├── hooks/            # Custom React hooks
├── services/         # API service functions
├── context/          # React context providers
└── utils/            # Utility functions
```

#### React Components
- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use destructuring for props
- Prefer named exports for components

#### Styling with Tailwind
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Use consistent spacing and color schemes
- Prefer Tailwind classes over custom CSS

#### State Management
- Use React's built-in useState and useReducer
- Use Context API for global state
- Keep state as close to where it's used as possible

## API Patterns

### RESTful Endpoints
- `GET` for retrieving resources
- `POST` for creating resources
- `PUT` for updating resources
- `DELETE` for removing resources

### Response Format
```javascript
// Success response
{
  "success": true,
  "data": { ... }
}

// Error response
{
  "success": false,
  "error": "Error description"
}
```

### Authentication Headers
```
Authorization: Bearer <access_token>
```

## Security Best Practices

1. **Never expose secrets** in code or logs
2. **Validate all user input** on both client and server
3. **Use parameterized queries** (Prisma handles this)
4. **Implement rate limiting** for authentication endpoints
5. **Use HTTPS** in production
6. **Sanitize output** to prevent XSS
7. **Hash passwords** before storing
8. **Encrypt sensitive tokens** at rest in production

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
OPENAI_API_KEY=sk-...
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:4000
```

## Common Commands

### Backend
```bash
npm install          # Install dependencies
npm run dev          # Run development server
npm run start        # Run production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run seed         # Seed demo data
```

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Run development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## Testing Guidelines

- Write tests for new features and bug fixes
- Test API endpoints with different scenarios
- Mock external services (OpenAI, S3, OAuth)
- Test authentication flows thoroughly
- Verify error handling works correctly

## Git Workflow

- Write clear, descriptive commit messages
- Keep commits focused on single changes
- Reference issue numbers in commits when applicable
- Test changes locally before committing

## Prisma Schema Guidelines

- Use UUID for primary keys
- Include `createdAt` timestamps
- Add appropriate indexes for query performance
- Use proper relations with `@relation` decorator
- Add `@@unique` constraints where needed

## Socket.io Events

Real-time events for memories and interactions:
- Emit events when memories are created/updated/deleted
- Emit events for likes and comments
- Handle connection/disconnection properly

## AI Mirror Integration

- Use OpenAI API for intelligent responses
- Implement fallback responses when API is unavailable
- Keep conversation context for better interactions
- Rate limit AI requests per user

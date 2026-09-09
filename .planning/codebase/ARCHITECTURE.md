# Architecture
- **Client-Server Model**: Vite handles the frontend UI, and an Express server handles the backend API (`server.ts`).
- **State Management**: Frontend uses Zustand (`src/stores/`).
- **Routing/API**: The Express app exposes various API endpoints. When deployed on Vercel, it uses Serverless function configuration to route to the API.
- **Local Persistence**: `server.ts` uses `getRuntimeDataFile()` which copies JSON DB files to `/tmp` in Vercel or reads locally if not in Vercel to allow file-based data operations.

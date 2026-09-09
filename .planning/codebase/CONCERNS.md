# Concerns
- **Local JSON databases**: The usage of `users.json` and file-based state limits scalability and can cause issues on Serverless platforms like Vercel (where `/tmp` is ephemeral). Needs migration to a real DB like Firestore or PostgreSQL.
- **Missing Tests**: No unit or integration tests visible.

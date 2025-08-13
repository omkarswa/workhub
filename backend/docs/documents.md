# Documents

Routes mounted at `/api/v1/documents` (`routes/documentRoutes.js`, `controllers/documentController.js`). All routes require auth.

## Capabilities
- Upload (multipart), list, get, update, delete, share, and download documents.
- Admin/HR have elevated permissions; owners and shared users have access per controller checks.

## Key Endpoints
- GET `/` → list (broad roles)
- POST `/` → upload (multipart `file`; 10MB; MIME whitelist)
- GET `/stats` → stats (admin, hr)
- GET `/download/:id` → download (broad roles)
- GET `/:id` → get by id (broad roles)
- PUT `/:id` → update metadata (broad roles)
- DELETE `/:id` → delete (admin, hr, manager)
- PUT `/:id/share` → share (admin, hr, manager)

## Notes for Frontend
- Use `FormData` with field `file`; handle server-side Multer error JSON (400) gracefully.
- Show progress UI; consider retry with backoff.

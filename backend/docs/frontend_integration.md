# Frontend Integration Guide

This guide summarizes how to call the backend safely and effectively.

## Base Setup
- Base URL: `/api/v1`
- Always send `Authorization: Bearer <token>` except for the auth test route.
- Use JSON for normal bodies and `multipart/form-data` for file uploads.

## Common Patterns
- Pagination/filtering: list endpoints accept typical query params (e.g., page, limit, filters) as implemented in controllers.
- Error handling: API returns JSON with `success`, `data` or `error` fields; show friendly messages.
- Dates: send ISO 8601 strings.

## Uploads
- Documents: field name `file` (documents service) or `document` (employee document upload).
- On 400 with Multer error message, surface validation feedback to user.

## Role-aware UI
- Hide/disable actions the current user cannot perform per endpoint matrix (`docs/endpoints.md`).
- Examples:
  - Only Admin/HR can create employees.
  - Only Admin/Manager can create projects.
  - Only Admin/HR/Manager can issue warnings.

## Example Fetch Snippets
```ts
// Authenticated GET
const res = await fetch('/api/v1/projects', { headers: { Authorization: `Bearer ${token}` } });

// Multipart upload
const fd = new FormData();
fd.append('file', file);
await fetch('/api/v1/documents', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
```

## Testing Tips
- Use Postman/Insomnia collections derived from `docs/endpoints.md`.
- Start with test users across roles (admin, hr, manager, employee) to validate RBAC.

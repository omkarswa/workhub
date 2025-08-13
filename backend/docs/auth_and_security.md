# Auth and Security

## Authentication
- JWT Bearer tokens. Include header: `Authorization: Bearer <token>`.
- `protect` middleware validates token, loads user, and enforces active status.

## Authorization (RBAC)
- `authorize('admin', 'hr', 'manager', 'employee')` guards routes by role.
- Ownership/membership checks inside controllers for finer access (e.g., document owner, project team).

## Token Lifecycle
- Issued on login, typically 1-day expiry (see JWT secret and expiry in env/config).

## Validation
- `express-validator` schemas per route; `validateRequest` returns 400 with details.

## File Upload Security
- Multer limits: 10MB; strict MIME whitelist in `routes/documentRoutes.js`.
- Documents ultimately stored via GridFS routines used by controllers.

## Data Protection
- Soft delete patterns on Users/Employees, Projects, Documents, Warnings, Appraisals.
- Mongoose population used for related data; avoid leaking private fields in projections.

## Environment
- `.env` holds `JWT_SECRET`, DB connection URI, etc.
- CORS enabled for frontend; tighten origins in production.

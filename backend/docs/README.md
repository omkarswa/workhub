# Workhub Backend Overview

This document explains the backend architecture, main modules, auth, and typical request flows so you can brief a mentor and guide frontend work.

## Stack
- Node.js + Express (`backend/server.js`)
- MongoDB + Mongoose (`backend/config/db.js`)
- JWT auth with role-based authorization (`backend/middleware/authMiddleware.js`)
- Validation via `express-validator` (`backend/middleware/validateRequest.js`)
- File uploads with Multer; storage backed by GridFS utilities (controller layer)

## Entry Point and App Setup
- `backend/server.js` sets up CORS, JSON parsing, DB connection, and mounts versioned routes:
  - `/api/v1/auth` → `routes/authRoutes.js`
  - `/api/v1/employees` → `routes/employeeRoutes.js`
  - `/api/v1/projects` → `routes/projectRoutes.js`
  - `/api/v1/appraisals` → `routes/appraisalRoutes.js`
  - `/api/v1/documents` → `routes/documentRoutes.js`
  - `/api/v1/warnings` → `routes/warningRoutes.js`

## Key Middleware
- `protect`: verifies JWT, attaches user, checks active status.
- `authorize(...roles)`: ensures user role is permitted for the route.
- `validateRequest(schema[])`: runs `express-validator` chains and returns 400 on failures.
- Multer upload middleware for `documents` and employee document uploads.

## Models (high level)
- `models/Employee.js`: employment profile, status, documents, warnings, appraisals, soft delete.
- `models/Role.js`: role definitions (e.g., admin, hr, manager, employee).
- Other feature models (Projects, Appraisals, Documents, Warnings) mirror route responsibilities with audit and soft-delete fields.

## Controllers
- `controllers/employeeController.js`: CRUD, status updates, document upload/verify, team members, stats, employee warnings.
- `controllers/projectController.js`: CRUD, manager assignment, team management, user projects, stats.
- `controllers/appraisalController.js`: CRUD, self-assessment, review, per-user access, stats.
- `controllers/documentController.js`: upload/download, get/update/delete/share, stats.
- `controllers/warningController.js`: CRUD, resolve/escalate/withdraw, employee/active filters.

## Error Handling
- Centralized error helpers (`middleware/validateRequest.js` and controller try/catch).
- Mongoose/JWT/Multer errors normalized to JSON responses with meaningful messages.

## Security
- JWT with 1-day expiry.
- Route-level role checks; some controller-level checks for ownership/membership.
- File type and size limits on uploads.
- Soft deletes across major resources.

## Typical Flows
- Auth: Client stores JWT after login; include `Authorization: Bearer <token>`.
- Employee CRUD: Admin/HR create and manage; managers read teams; employees access own profile.
- Projects: Admin/Managers create, assign manager, add/remove team; members can view.
- Documents: Owners/Admin/HR/Managers (per sharing) can access; upload uses `multipart/form-data`.
- Appraisals: Employee self-assessment → Manager/HR review → status changes.
- Warnings: Admin/HR/Managers create and manage; track status transitions.

## Plan of Action (for mentoring/frontend)
1. Map structure and routes (done).
2. Produce endpoint matrix and plain-language docs (done; see `docs/endpoints.md` and this doc set).
3. Optionally wire Swagger UI for interactive API reference.
4. Deepen OpenAPI schemas from Mongoose models.
5. Add auth examples and frontend integration snippets.

See companion docs:
- `auth_and_security.md`
- `employees.md`, `projects.md`, `appraisals.md`, `documents.md`, `warnings.md`
- `frontend_integration.md`

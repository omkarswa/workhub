# Employees

Routes mounted at `/api/v1/employees` (`routes/employeeRoutes.js`, `controllers/employeeController.js`). All routes require auth.

## Capabilities
- List/filter/paginate employees (Admin/HR/Manager).
- Create/Update/Delete employees (Admin/HR; updates validated).
- Update employment status (Admin/HR) with effective date + reason.
- Get own profile (`/me`) and manager's team (`/team`).
- Manage employee documents: list, upload (multipart/form-data), verify (Admin/HR).
- Manage employee warnings: list and issue for a given employee.

## Key Endpoints
- GET `/` → list (roles: admin, hr, manager)
- POST `/` → create (roles: admin, hr)
- GET `/stats` → stats (roles: admin, hr)
- GET `/me` → self (roles: admin, hr, manager, employee)
- GET `/team` → manager team (roles: admin, hr, manager)
- GET `/:id` → get by id (roles: admin, hr, manager, employee)
- PUT `/:id` → update (roles: admin, hr)
- DELETE `/:id` → delete (roles: admin, hr)
- PUT `/:id/status` → status update (roles: admin, hr)
- GET `/:id/documents` → list docs (broad roles)
- POST `/:id/documents` → upload doc (multipart, `document` field)
- PUT `/documents/:documentId/verify` → verify doc (admin, hr)
- GET `/:id/warnings` → list warnings (admin, hr, manager)
- POST `/:id/warnings` → issue warning (admin, hr, manager)

## Validation Highlights
- Strong `express-validator` schemas for create/update/status/document/warning.

## Notes for Frontend
- Use `FormData` for uploads. Field names: `document`, `documentType`, `description`.
- Respect role-based UI: hide actions not permitted by role.

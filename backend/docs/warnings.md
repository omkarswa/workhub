# Warnings

Routes mounted at `/api/v1/warnings` (`routes/warningRoutes.js`, `controllers/warningController.js`). All routes require auth.

## Capabilities
- CRUD warnings with validation.
- State transitions: resolve, escalate, withdraw.
- Filter by employee and get active warnings.

## Key Endpoints
- GET `/` → list (admin, hr, manager)
- POST `/` → create (admin, hr, manager)
- GET `/active` → active warnings (admin, hr, manager)
- GET `/employee/:employeeId` → for employee (admin, hr, manager)
- GET `/:id` → get by id (admin, hr, manager)
- PUT `/:id` → update (admin, hr, manager)
- DELETE `/:id` → delete (admin, hr)
- PUT `/:id/resolve` → resolve (admin, hr, manager)
- PUT `/:id/escalate` → escalate (admin, hr, manager)
- PUT `/:id/withdraw` → withdraw (admin, hr)

## Notes for Frontend
- Provide reasons/notes where requested; server validates.
- Represent state clearly in UI and disable invalid transitions.

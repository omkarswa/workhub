# Appraisals

Routes mounted at `/api/v1/appraisals` (`routes/appraisalRoutes.js`, `controllers/appraisalController.js`). All routes require auth.

## Capabilities
- CRUD appraisals (create/update by Admin/HR/Manager; delete by Admin/HR).
- Employee self-assessment; Manager/HR review.
- Get current user's appraisals; fetch appraisal stats.

## Key Endpoints
- GET `/` → list (broad roles)
- POST `/` → create (admin, hr, manager)
- GET `/stats` → stats (admin, hr, manager)
- GET `/me` → my appraisals (broad roles)
- GET `/:id` → get by id (broad roles)
- PUT `/:id` → update (admin, hr, manager)
- DELETE `/:id` → delete (admin, hr)
- PUT `/:id/self-assessment` → submit self assessment (broad roles)
- PUT `/:id/review` → submit review (admin, hr, manager)
- GET `/users/:userId/appraisals` → list for a user (admin, hr, manager)

## Notes for Frontend
- Use role-aware UI to enable self-assessment vs review.
- Persist draft forms client-side if needed; server expects final submissions.

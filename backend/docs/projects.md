# Projects

Routes mounted at `/api/v1/projects` (`routes/projectRoutes.js`, `controllers/projectController.js`). All routes require auth.

## Capabilities
- CRUD on projects (create/update by Admin/Manager; delete by Admin).
- Assign project manager.
- Manage team (add/remove members) and view team.
- Get projects for current user; fetch project stats.

## Key Endpoints
- GET `/` → list (roles: admin, hr, manager, employee)
- POST `/` → create (roles: admin, manager)
- GET `/stats` → stats (roles: admin, hr, manager)
- GET `/user/me` → my projects (broad roles)
- GET `/:id` → get by id (broad roles)
- PUT `/:id` → update (roles: admin, manager)
- DELETE `/:id` → delete (admin)
- PUT `/:id/manager` → assign manager (admin, manager)
- GET `/:id/team` → team (broad roles)
- POST `/:id/team` → add member (admin, manager)
- DELETE `/:id/team/:userId` → remove member (admin, manager)

## Notes for Frontend
- Check current user's membership before surfacing sensitive actions.
- Optimistic UI for team changes; backend enforces membership and roles.

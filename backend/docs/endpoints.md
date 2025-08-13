# Workhub API Endpoint Matrix

Base URL: `/api/v1`

Legend: Auth = JWT required; Roles = allowed roles via `authorize()`; Ctrl = controller function; File = controller file

## Auth
- GET `/auth/` — Auth test (no Auth)

## Employees (Auth: Yes)
- GET `/employees/` — Roles: admin, hr, manager — Ctrl: `getEmployees` — File: `controllers/employeeController.js`
- POST `/employees/` — Roles: admin, hr — Ctrl: `createEmployee` — Validations: `createEmployeeSchema`
- GET `/employees/stats` — Roles: admin, hr — Ctrl: `getEmployeeStats`
- GET `/employees/me` — Roles: admin, hr, manager, employee — Ctrl: `getEmployee`
- GET `/employees/team` — Roles: admin, hr, manager — Ctrl: `getTeamMembers`
- GET `/employees/:id` — Roles: admin, hr, manager, employee — Ctrl: `getEmployee`
- PUT `/employees/:id` — Roles: admin, hr — Ctrl: `updateEmployee` — Validations: `updateEmployeeSchema`
- DELETE `/employees/:id` — Roles: admin, hr — Ctrl: `deleteEmployee`
- PUT `/employees/:id/status` — Roles: admin, hr — Ctrl: `updateEmployeeStatus` — Validations: `statusUpdateSchema`
- GET `/employees/:id/documents` — Roles: admin, hr, manager, employee — Ctrl: `getEmployeeDocuments`
- POST `/employees/:id/documents` — Roles: admin, hr, manager, employee — Upload: `upload.single('document')` — Ctrl: `uploadDocument` — Validations: `documentUploadSchema`
- PUT `/employees/documents/:documentId/verify` — Roles: admin, hr — Ctrl: `verifyDocument`
- GET `/employees/:id/warnings` — Roles: admin, hr, manager — Ctrl: `getEmployeeWarnings`
- POST `/employees/:id/warnings` — Roles: admin, hr, manager — Ctrl: `issueWarning` — Validations: `warningSchema`

## Projects (Auth: Yes)
- GET `/projects/` — Roles: admin, hr, manager, employee — Ctrl: `getProjects` — File: `controllers/projectController.js`
- POST `/projects/` — Roles: admin, manager — Ctrl: `createProject`
- GET `/projects/stats` — Roles: admin, hr, manager — Ctrl: `getProjectStats`
- GET `/projects/user/me` — Roles: admin, hr, manager, employee — Ctrl: `getUserProjects`
- GET `/projects/:id` — Roles: admin, hr, manager, employee — Ctrl: `getProject`
- PUT `/projects/:id` — Roles: admin, manager — Ctrl: `updateProject`
- DELETE `/projects/:id` — Roles: admin — Ctrl: `deleteProject`
- PUT `/projects/:id/manager` — Roles: admin, manager — Ctrl: `assignManager`
- GET `/projects/:id/team` — Roles: admin, hr, manager, employee — Ctrl: `getProjectTeam`
- POST `/projects/:id/team` — Roles: admin, manager — Ctrl: `addTeamMember`
- DELETE `/projects/:id/team/:userId` — Roles: admin, manager — Ctrl: `removeTeamMember`

## Appraisals (Auth: Yes)
- GET `/appraisals/` — Roles: admin, hr, manager, employee — Ctrl: `getAppraisals` — File: `controllers/appraisalController.js`
- POST `/appraisals/` — Roles: admin, hr, manager — Ctrl: `createAppraisal`
- GET `/appraisals/stats` — Roles: admin, hr, manager — Ctrl: `getAppraisalStats`
- GET `/appraisals/me` — Roles: admin, hr, manager, employee — Ctrl: `getMyAppraisals`
- GET `/appraisals/:id` — Roles: admin, hr, manager, employee — Ctrl: `getAppraisal`
- PUT `/appraisals/:id` — Roles: admin, hr, manager — Ctrl: `updateAppraisal`
- DELETE `/appraisals/:id` — Roles: admin, hr — Ctrl: `deleteAppraisal`
- PUT `/appraisals/:id/self-assessment` — Roles: admin, hr, manager, employee — Ctrl: `submitSelfAssessment`
- PUT `/appraisals/:id/review` — Roles: admin, hr, manager — Ctrl: `submitReview`
- GET `/appraisals/users/:userId/appraisals` — Roles: admin, hr, manager — Ctrl: `getAppraisals`

## Documents (Auth: Yes)
- GET `/documents/` — Roles: admin, hr, manager, employee — Ctrl: `getDocuments` — File: `controllers/documentController.js`
- POST `/documents/` — Roles: admin, hr, manager, employee — Upload: `upload.single('file')` (+ multer error handler) — Ctrl: `uploadDocument`
- GET `/documents/stats` — Roles: admin, hr — Ctrl: `getDocumentStats`
- GET `/documents/download/:id` — Roles: admin, hr, manager, employee — Ctrl: `downloadDocument`
- GET `/documents/:id` — Roles: admin, hr, manager, employee — Ctrl: `getDocument`
- PUT `/documents/:id` — Roles: admin, hr, manager, employee — Ctrl: `updateDocument`
- DELETE `/documents/:id` — Roles: admin, hr, manager — Ctrl: `deleteDocument`
- PUT `/documents/:id/share` — Roles: admin, hr, manager — Ctrl: `shareDocument`

## Warnings (Auth: Yes)
- GET `/warnings/` — Roles: admin, hr, manager — Ctrl: `getWarnings` — File: `controllers/warningController.js`
- POST `/warnings/` — Roles: admin, hr, manager — Ctrl: `createWarning` — Validations: `createWarningSchema`
- GET `/warnings/active` — Roles: admin, hr, manager — Ctrl: `getActiveWarnings`
- GET `/warnings/employee/:employeeId` — Roles: admin, hr, manager — Ctrl: `getEmployeeWarnings`
- GET `/warnings/:id` — Roles: admin, hr, manager — Ctrl: `getWarning`
- PUT `/warnings/:id` — Roles: admin, hr, manager — Ctrl: `updateWarning` — Validations: `updateWarningSchema`
- DELETE `/warnings/:id` — Roles: admin, hr — Ctrl: `deleteWarning`
- PUT `/warnings/:id/resolve` — Roles: admin, hr, manager — Ctrl: `resolveWarning` — Validations: `actionSchema`
- PUT `/warnings/:id/escalate` — Roles: admin, hr, manager — Ctrl: `escalateWarning` — Validations: `actionSchema`
- PUT `/warnings/:id/withdraw` — Roles: admin, hr — Ctrl: `withdrawWarning` — Validations: `actionSchema`

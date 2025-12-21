# WebService_TermProject
1️⃣ 실제 엔드포인트 목록 정리 (METHOD + PATH)
공통 prefix 정리

auth.js → /api/auth

users.js → /api/users

workspaces.js → /api/workspaces

projects.js → /api/workspaces/:workspaceId/projects

tasks.js → /api/workspaces/:workspaceId/projects/:projectId/tasks

comments.js → /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments

tags.js → /api/workspaces/:workspaceId/tags

🔐 Auth (auth.js)

POST /api/auth/signup

POST /api/auth/login

POST /api/auth/refresh

POST /api/auth/logout

Social (authSocial.js)

POST /api/auth/social/firebase

GET /api/auth/social/kakao/start

GET /api/auth/social/kakao/callback

👉 7개

👤 Users (users.js)

GET /api/users/me

PATCH /api/users/me

DELETE /api/users/me

GET /api/users

GET /api/users/:id

PATCH /api/users/:id

DELETE /api/users/:id

👉 7개 (누적 14)
※ requireAdmin이 걸려 있으면 “권한 구현” 가점 포인트

🏢 Workspaces (workspaces.js)

POST /api/workspaces

GET /api/workspaces

GET /api/workspaces/:workspaceId

PATCH /api/workspaces/:workspaceId

DELETE /api/workspaces/:workspaceId

Members (같은 파일)

GET /api/workspaces/:workspaceId/members

POST /api/workspaces/:workspaceId/members

DELETE /api/workspaces/:workspaceId/members/:userId

👉 8개 (누적 22)

📁 Projects (projects.js)

POST /api/workspaces/:workspaceId/projects

GET /api/workspaces/:workspaceId/projects

GET /api/workspaces/:workspaceId/projects/:projectId

PATCH /api/workspaces/:workspaceId/projects/:projectId

DELETE /api/workspaces/:workspaceId/projects/:projectId

👉 5개 (누적 27)

✅ Tasks (tasks.js)

POST /api/workspaces/:workspaceId/projects/:projectId/tasks

GET /api/workspaces/:workspaceId/projects/:projectId/tasks

GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId

PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId

DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId

👉 5개 (누적 32)

💬 Comments (comments.js)

POST /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments

GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments

PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId

DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId

👉 4개 (누적 36)

🏷 Tags (tags.js)

GET /api/workspaces/:workspaceId/tags

POST /api/workspaces/:workspaceId/tags

DELETE /api/workspaces/:workspaceId/tags/:tagId

Task–Tag 연결

POST /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags/:tagId

DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags/:tagId

👉 5개 (누적 41)

✅ 엔드포인트 총합

총 41개
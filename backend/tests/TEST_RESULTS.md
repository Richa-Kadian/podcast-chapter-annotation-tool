# Momento API — Test Results

Recorded on 26 Oct 2026 on macOS with Node.js v24.16.0. The database was a real MongoDB 8.2.6 server started locally by `mongodb-memory-server`, not a mock. These are results from runs that were actually executed, with nothing filled in by hand.

**Not yet run against the deployed server.** Deployment needs the project owner's MongoDB Atlas and Render accounts. After deploying, run section 2 again with `baseUrl` set to the deployed API.

## 1. Automated tests — `npm test`

Command: `cd backend && npm test`

| Suite | What it checks |
| :--- | :--- |
| Authentication API (15 tests) | health check; signup stores a bcrypt hash and never returns it; email normalised; duplicate email → 409; invalid fields → 400 with per-field errors; valid login; wrong password and unknown email both → 401 with the same message; the old "demo" email bypass is gone; `/me` with and without a token; tampered token → 401; logout invalidates the token; demo account; malformed JSON → 400; unknown route → 404 |
| Lecture API (12 tests) | create (owner taken from the token, client-sent `owner`/`bestScore` ignored); YouTube id; validation errors; list (own lectures only, newest first, no transcript); get one; malformed id → 400; missing → 404; update; invalid update → 400; delete cascades to notes; delete-all only touches the caller's library |
| Notes API (3 tests) | create/list in order; empty text or negative time → 400; update and delete |
| Quiz attempts API (4 tests) | server-side grading (client-sent score ignored); best score kept; streak starts at ≥ 60%; history newest first; empty answers → 400 |
| Study progress API (4 tests) | empty streak; flashcards saved, de-duplicated, reloaded; card in both piles → 400; reset |
| Streak rules (2 tests) | consecutive days extend; same day counts once; < 60% ignored; a gap restarts at 1; a stale streak reads as 0 |
| Authorization and ownership (14 tests) | 6 protected endpoints without a token → 401; non-Bearer header → 401; another user reading/updating/deleting a lecture → 403 and data unchanged; another user's notes, note edits, quiz attempts and flashcards → 403; "delete all" can't touch other users; CORS rejects unknown origins |
| LocalStorage migration API (4 tests) | valid sessions imported with notes, flashcards and streak; invalid records reported with a reason; re-import skipped; streak never overwritten; owner always the signed-in user; bad payload → 400 |

Result:

```
✔ Streak rules (0.321375ms)
ℹ tests 58
ℹ suites 8
ℹ pass 58
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6547.612959
```

## 2. Postman collection — run with Newman against the running server

The real server was started with `npm start` (`NODE_ENV=development`), connected to MongoDB, and listening on `http://localhost:5050`.

Command: `npx newman run backend/tests/postman/Momento.postman_collection.json`

Result: **42 requests, 67 assertions, 0 failures.**

| Folder | Request | Endpoint | Actual status |
| :--- | :--- | :--- | :--- |
| 1. Health | Health check | `GET /health` | 200 OK |
| 2. Authentication | Register user A | `POST /auth/signup` | 201 Created |
| 2. Authentication | Register duplicate email (409) | `POST /auth/signup` | 409 Conflict |
| 2. Authentication | Register with invalid fields (400) | `POST /auth/signup` | 400 Bad Request |
| 2. Authentication | Login with valid credentials | `POST /auth/login` | 200 OK |
| 2. Authentication | Login with wrong password (401) | `POST /auth/login` | 401 Unauthorized |
| 2. Authentication | Login with unknown email (401) | `POST /auth/login` | 401 Unauthorized |
| 2. Authentication | Login with "demo" email no longer bypasses auth (401) | `POST /auth/login` | 401 Unauthorized |
| 2. Authentication | Get current user | `GET /auth/me` | 200 OK |
| 2. Authentication | Get current user without token (401) | `GET /auth/me` | 401 Unauthorized |
| 3. Lectures | List lectures without token (401) | `GET /lectures` | 401 Unauthorized |
| 3. Lectures | Create lecture | `POST /lectures` | 201 Created |
| 3. Lectures | Create lecture with invalid data (400) | `POST /lectures` | 400 Bad Request |
| 3. Lectures | List my lectures | `GET /lectures` | 200 OK |
| 3. Lectures | Get one lecture | `GET /lectures/:id` | 200 OK |
| 3. Lectures | Get lecture with malformed id (400) | `GET /lectures/not-a-valid-id` | 400 Bad Request |
| 3. Lectures | Get lecture that does not exist (404) | `GET /lectures/:id` | 404 Not Found |
| 3. Lectures | Update lecture | `PUT /lectures/:id` | 200 OK |
| 4. Notes | Create timestamped note | `POST /lectures/:id/notes` | 201 Created |
| 4. Notes | Create empty note (400) | `POST /lectures/:id/notes` | 400 Bad Request |
| 4. Notes | List notes | `GET /lectures/:id/notes` | 200 OK |
| 4. Notes | Update note | `PUT /notes/:id` | 200 OK |
| 5. Quiz & Progress | Save quiz attempt (50%) | `POST /lectures/:id/quiz-attempts` | 201 Created |
| 5. Quiz & Progress | Save quiz attempt (100%) | `POST /lectures/:id/quiz-attempts` | 201 Created |
| 5. Quiz & Progress | Save quiz attempt without answers (400) | `POST /lectures/:id/quiz-attempts` | 400 Bad Request |
| 5. Quiz & Progress | List quiz attempts | `GET /lectures/:id/quiz-attempts` | 200 OK |
| 5. Quiz & Progress | Save flashcard progress | `PUT /progress/flashcards/:id` | 200 OK |
| 5. Quiz & Progress | Get flashcard progress | `GET /progress/flashcards/:id` | 200 OK |
| 5. Quiz & Progress | Get study progress | `GET /progress` | 200 OK |
| 6. Another user's data | Register user B | `POST /auth/signup` | 201 Created |
| 6. Another user's data | B reads A's lecture (403) | `GET /lectures/:id` | 403 Forbidden |
| 6. Another user's data | B updates A's lecture (403) | `PUT /lectures/:id` | 403 Forbidden |
| 6. Another user's data | B reads A's notes (403) | `GET /lectures/:id/notes` | 403 Forbidden |
| 6. Another user's data | B deletes A's note (403) | `DELETE /notes/:id` | 403 Forbidden |
| 6. Another user's data | B's library does not include A's lecture | `GET /lectures` | 200 OK |
| 6. Another user's data | A's lecture is unchanged | `GET /lectures/:id` | 200 OK |
| 7. Delete & logout | Delete note | `DELETE /notes/:id` | 200 OK |
| 7. Delete & logout | Delete lecture | `DELETE /lectures/:id` | 200 OK |
| 7. Delete & logout | Get deleted lecture (404) | `GET /lectures/:id` | 404 Not Found |
| 7. Delete & logout | Logout | `POST /auth/logout` | 200 OK |
| 7. Delete & logout | Old token rejected after logout (401) | `GET /auth/me` | 401 Unauthorized |
| 7. Delete & logout | Malformed JSON body (400) | `POST /auth/login` | 400 Bad Request |

## 3. Database checks (queried directly in MongoDB after the runs)

- `users` documents store `password` as a bcrypt hash, e.g. `$2b$10$d21TLOgIdujw…`. No plain-text passwords.
- `quizattempts` store each answer with a server-computed `isCorrect`. For example, an attempt submitted with a client-side `score: 4` was stored as `score: 2, percentage: 50`.

## 4. Frontend ↔ backend in a real browser

The unchanged CE1 pages were served from `frontend/` on `http://localhost:5500` and driven in headless Google Chrome by a Playwright script against the running API. Result: **37/37 checks passed.**

```
PASS  Signup form creates account and redirects to index
PASS  Import prompt offered for old LocalStorage data  — (confirm dialog: "We found 1 study session saved in this browser…")
PASS  Signup + import requests succeeded  — POST /api/auth/signup 201, POST /api/migration/local-storage 200
PASS  Original LocalStorage data kept after import
PASS  Migration marked as done
PASS  Token stored in sessionStorage, no password in storage
PASS  Home page shows library count from API
PASS  Header shows signed-in name
PASS  Imported lecture appears in library
PASS  Opening lecture loads transcript via GET /lectures/:id
PASS  Imported note shown
PASS  Imported flashcard progress shown (known=1)
PASS  Upload creates lecture via POST /lectures
PASS  New lecture opened in workspace
PASS  Transcript rendered for new lecture
PASS  Duration detected from real file (1:00)
PASS  Note saved via POST /lectures/:id/notes
PASS  Flashcards saved via PUT /progress/flashcards/:id
PASS  Quiz attempt saved via POST /quiz-attempts
PASS  Quiz score is 100%
PASS  Streak returned by server shown (1 day)
PASS  Best score badge updated
PASS  After refresh: library still has 2 lectures
PASS  After refresh: best score 100% kept on card
PASS  After refresh: note persisted
PASS  After refresh: flashcard piles persisted
PASS  After refresh: local-file media limitation explained
PASS  Dev panel shows server streak
PASS  Note deleted via DELETE /notes/:id
PASS  Lecture deleted via DELETE /lectures/:id
PASS  Sign out calls POST /auth/logout
PASS  app.html redirects to login when signed out
PASS  Wrong password shows existing error UI
PASS  Login redirects back to the page that required auth (app.html)
PASS  Library restored after re-login (1 lecture)
PASS  Demo button signs into server demo account
PASS  No unexpected console errors (expected: favicon 404, wrong-password 401, revoked blob after refresh)

37/37 checks passed
```

The three console messages filtered out by the last check were all expected: the site has no `favicon.ico` (404, as in CE1), the deliberate wrong-password attempt (401), and the revoked `blob:` URL after a refresh. The app now catches that last one and shows a message explaining why the local file can't play.

Screenshots of the original CE1 pages and the CE2 pages were compared side by side. Layout, colours and components are identical. The only differences are these text changes, which correct claims that are no longer true:
- the dev-panel labels
- the "stored in your browser" subtitle
- the "LocalStorage" footer badge
- the hero stat
- the storage FAQ answer

## 5. Production-mode checks (manual, with curl)

| Check | Result |
| :--- | :--- |
| Start without `MONGODB_URI` / `JWT_SECRET` | Exits with code 1: `Missing required environment variables: MONGODB_URI, JWT_SECRET` |
| `NODE_ENV=production` with a short `JWT_SECRET` | Exits with code 1: `JWT_SECRET must be at least 32 characters long in production.` |
| Unreachable MongoDB | Gives up after 10 s and exits with code 1 (no hanging server) |
| CORS with `FRONTEND_URL=https://momento.onrender.com` | That origin is allowed; `http://localhost:5500` and `https://evil.example.com` get no `Access-Control-Allow-Origin` header |
| Port 5000 on macOS | Taken by AirPlay Receiver (`Server: AirTunes`, 403 for everything), so the default port is 5050 |

# Momento — Lecture Study Companion (CE2: Backend + MongoDB)

Momento turns a recorded lecture into an interactive study session: a synced transcript, auto-detected chapters, timestamped notes, a quiz where every wrong answer links back to the exact second it was explained, flashcards, and a daily study streak.

- **CE1** built the frontend (HTML, CSS, vanilla JavaScript). All data lived in the browser's LocalStorage.
- **CE2** (this version) adds a **Node.js + Express + MongoDB backend** in MVC style. The existing frontend now calls the backend's REST API for authentication and saving data. The UI is the same; only how data is stored and who is signed in has changed.

---

## 1. Technology stack

| Layer | Technology |
| :--- | :--- |
| Frontend | HTML5, CSS3, vanilla JavaScript (unchanged from CE1) |
| Backend | Node.js (≥ 20), Express 5 |
| Database | MongoDB (MongoDB Atlas in production) via Mongoose 9 |
| Authentication | JSON Web Tokens (`jsonwebtoken`), passwords hashed with `bcryptjs` |
| Security extras | CORS whitelist (`cors`), login rate limiting (`express-rate-limit`) |
| Configuration | Environment variables (`dotenv`) |
| Testing | Node's built-in test runner + `supertest` + `mongodb-memory-server`; Postman collection (run with Newman) |
| Deployment | Render (Blueprint in `render.yaml`) + MongoDB Atlas |

---

## 2. Architecture

```
 Browser (frontend/)                       Backend (backend/)                       Database
 ─────────────────────                     ──────────────────────────────           ─────────────
 app.html, login.html, …                   Express app (src/app.js)
   js/config.js  → API base URL              routes/       URL → controller
   js/api.js     → fetch + token   ──HTTP──▶ middleware/   auth, errors, 404     ──▶  MongoDB
   js/app.js, login.js, …          ◀─JSON──  controllers/  validation + logic          users
                                             models/       Mongoose schemas            lectures
 sessionStorage: login token,                services/     shared business rules       notes
 temporary media URLs                        config/       env vars, DB connection     quizattempts
                                                                                       studyprogresses
```

**How MVC applies here**

- **Model**: the Mongoose schemas in `backend/src/models/`. They define the data and its validation rules.
- **View**: the existing CE1 frontend in `frontend/`. It isn't rendered by the server; it is a separate static site that talks to the API using JSON.
- **Controller**: `backend/src/controllers/`. Each controller reads the request, validates it, checks ownership, uses the models, and sends a JSON response.
- **Routes**: map each URL and HTTP method to a controller function.
- **Middleware**: does work shared by many routes (checking the login token, turning errors into JSON, handling unknown routes).

**Request flow example: adding a note**

1. `app.js` calls `api.post('/lectures/<id>/notes', { text, time })`.
2. `js/api.js` adds the header `Authorization: Bearer <token>` and sends the request.
3. `routes/noteRoutes.js` runs `protect` (from `middleware/authMiddleware.js`), which verifies the token and loads the user.
4. `controllers/noteController.js#createNote` calls `findOwnedLecture()`, which checks the lecture belongs to this user. It then creates the note, and the `Note` model validates it.
5. The response is `201 { success: true, data: note }`, and the UI renders the note.

---

## 3. Folder structure

```
podcast-chapter-annotation-tool/
├── frontend/                     # CE1 website (moved here unchanged, plus API integration)
│   ├── index.html  how.html  app.html  compare.html  login.html
│   ├── css/                      # untouched
│   ├── js/
│   │   ├── config.js             # NEW — the only place the API URL is written
│   │   ├── api.js                # NEW — fetch wrapper: JSON, token, timeout, errors
│   │   ├── common.js             # sign-in state from the backend token, sign out, reset
│   │   ├── login.js              # sign in / sign up / demo via API + one-time LocalStorage import
│   │   ├── app.js                # library, notes, quiz, flashcards, streak via API
│   │   ├── home.js               # library count via API
│   │   └── how.js, compare.js    # untouched
│   └── README.md
├── backend/
│   ├── src/
│   │   ├── server.js             # entry point: validate config → connect DB → listen
│   │   ├── app.js                # builds the Express app (CORS, JSON parsing, routes, errors)
│   │   ├── config/
│   │   │   ├── env.js            # reads environment variables into one config object
│   │   │   └── database.js       # Mongoose connect / disconnect / health status
│   │   ├── models/               # User, Lecture, Note, QuizAttempt, StudyProgress
│   │   ├── controllers/          # auth, lecture, note, quiz, progress, migration, health
│   │   ├── routes/               # one router per resource + index.js mounting them under /api
│   │   ├── middleware/           # authMiddleware (protect), errorMiddleware, notFoundMiddleware
│   │   ├── services/             # tokenService (JWT), streakService, lectureAccess (ownership check)
│   │   └── utils/                # AppError, validators, cleanJson (_id → id)
│   ├── tests/                    # automated API tests + Postman collection + recorded results
│   ├── .env.example              # template for backend/.env (no real secrets)
│   └── package.json
├── render.yaml                   # Render deployment blueprint (API + static frontend)
├── ARCHITECTURE.md               # design spec for a future long-media job pipeline (not implemented)
└── README.md                     # this file
```

---

## 4. MongoDB data models

| Model (collection) | Key fields | Notes |
| :--- | :--- | :--- |
| **User** (`users`) | `name`, `email` (unique, lowercase), `password` (bcrypt hash, `select:false`), `tokenVersion`, `isDemo`, timestamps | The password hash is never returned. `tokenVersion` lets logout invalidate tokens. |
| **Lecture** (`lectures`) | `owner` → User, `title`, `type` (`video`/`audio`/`youtube`), `ytId`, `mediaUrl`, `duration`, `genre`, `lines[]` {start, end, speaker, text, keyword}, `chapters[]` {startIndex, startTime, endTime, title, keyword}, `bestScore`, `legacyId`, timestamps | Same shape as the CE1 `StudySession` object. Transcripts are short (about 20 lines), so they are embedded. They are left out of the library list and only loaded when a lecture is opened. |
| **Note** (`notes`) | `user`, `lecture`, `text`, `time` (seconds into the media), timestamps | Powers the "click a note to jump to that moment" feature. |
| **QuizAttempt** (`quizattempts`) | `user`, `lecture`, `answers[]` {question, correctAnswer, selectedAnswer, isCorrect, timestamp, chapter}, `score`, `totalQuestions`, `percentage`, `createdAt` (attempt date) | Graded **on the server**, so a client cannot submit a fake score. |
| **StudyProgress** (`studyprogresses`) | `user` (unique), `currentStreak`, `bestStreak`, `lastStudyDate`, `flashcards[]` {lecture, known[], studying[]} | One document per user. The streak is updated only by saving a quiz attempt. |

Indexes: unique `users.email`; `lectures {owner, createdAt}`; unique partial `lectures {owner, legacyId}` (stops the same browser session being imported twice); `notes {lecture, user, createdAt}`; `quizattempts {lecture, user, createdAt}`; unique `studyprogresses.user`.

---

## 5. REST API

Base URL: `http://localhost:5050/api` locally, or `https://<your-api>.onrender.com/api` once deployed.

Every response has the same shape:
- Success: `{ "success": true, "data": … }`
- Error: `{ "success": false, "message": "…", "errors": { field: message } }` (`errors` is only present for validation problems)

🔒 = needs the header `Authorization: Bearer <token>`.

| Method & path | Purpose | Success | Typical errors |
| :--- | :--- | :--- | :--- |
| `GET /health` | API and database status | 200 (503 if the DB is down) | |
| `POST /auth/signup` | Register `{name, email, password}` | 201 `{token, user}` | 400 invalid fields, 409 email exists |
| `POST /auth/login` | Sign in `{email, password}` | 200 `{token, user}` | 400 missing fields, 401 wrong credentials, 429 too many attempts |
| `POST /auth/demo` | Sign into the shared demo account (only if `DEMO_LOGIN_ENABLED=true`) | 200 | 404 when disabled |
| `POST /auth/logout` 🔒 | Invalidate all of this user's tokens | 200 | 401 |
| `GET /auth/me` 🔒 | Current user | 200 | 401 |
| `GET /lectures` 🔒 | My library, newest first (without transcript lines) | 200 | 401 |
| `POST /lectures` 🔒 | Create a lecture | 201 | 400 validation |
| `DELETE /lectures` 🔒 | Delete my whole library (used by "Reset demo data") | 200 | |
| `GET /lectures/:id` 🔒 | One lecture, with its transcript | 200 | 400 bad id, 403 not yours, 404 |
| `PUT /lectures/:id` 🔒 | Update `title`, `duration`, `genre`, `lines`, `chapters` | 200 | 400, 403, 404 |
| `DELETE /lectures/:id` 🔒 | Delete a lecture and its notes, attempts and flashcards | 200 | 400, 403, 404 |
| `GET /lectures/:lectureId/notes` 🔒 | Notes for a lecture | 200 | 403, 404 |
| `POST /lectures/:lectureId/notes` 🔒 | Add a note `{text, time}` | 201 | 400, 403, 404 |
| `PUT /notes/:id` 🔒 | Edit a note `{text?, time?}` | 200 | 400, 403, 404 |
| `DELETE /notes/:id` 🔒 | Delete a note | 200 | 400, 403, 404 |
| `GET /lectures/:lectureId/quiz-attempts` 🔒 | Attempt history, newest first | 200 | 403, 404 |
| `POST /lectures/:lectureId/quiz-attempts` 🔒 | Save `{answers:[{question, correctAnswer, selectedAnswer, timestamp, chapter}]}`. The server grades it and updates `bestScore` and the streak | 201 `{attempt, bestScore, streak}` | 400, 403, 404 |
| `GET /progress` 🔒 | Streak `{current, best, lastDate}` | 200 | |
| `DELETE /progress` 🔒 | Reset streak and flashcards | 200 | |
| `GET /progress/flashcards/:lectureId` 🔒 | Flashcard piles for a lecture | 200 | 403, 404 |
| `PUT /progress/flashcards/:lectureId` 🔒 | Save `{known:[], studying:[]}` | 200 | 400, 403, 404 |
| `POST /migration/local-storage` 🔒 | One-time import of CE1 LocalStorage data | 200 `{imported, skipped, failed[], streakImported}` | 400 |

Why there is no `PUT /progress`: the streak is computed by the server (`services/streakService.js`) whenever a quiz attempt is saved. If a client could set it directly, anyone could give themselves a 100-day streak.

**Ownership rule.** Every lecture, note, attempt and flashcard request goes through `findOwnedLecture()` or `findOwnedNote()`. These return 400 for a malformed id, 404 if the record doesn't exist, and 403 if it belongs to another user. The owner is always `req.user._id` from the verified token, never an id sent by the browser.

---

## 6. How the frontend uses the backend

| CE1 browser storage | CE2 | Why |
| :--- | :--- | :--- |
| `momento_users_v1` (LocalStorage, **plain-text passwords**) | `users` collection, bcrypt hashes | Real authentication |
| `momento_library_v1__<userId>` | `lectures` collection | Persistent data, available on any device |
| `momento_streak_v1__<userId>` | `studyprogresses` (streak) | Persistent data, computed by the server |
| `momento_notes_<sessionId>` | `notes` collection | Persistent data |
| `momento_fc_states_<sessionId>` | `studyprogresses.flashcards` | Persistent data |
| `momento_current_user` (sessionStorage) | **Kept**, but only as a cached copy for the header. The real check is the token | Temporary UI state |
| — | `momento_auth_token` (sessionStorage) | Login token. Signing out or closing the tab ends the session, as in CE1 |
| `momento_auth_redirect` (sessionStorage) | **Kept** | Temporary navigation state (where to go back to after login) |
| `momento_blob_<sessionId>` (sessionStorage) | **Kept** | A local file's temporary `blob:` URL, which can't be saved on a server |
| — | `momento_migrated_v1__<oldUserId>` (LocalStorage) | Remembers that the one-time import is done |

**Features and how each one now works**

| Feature | Behaviour |
| :--- | :--- |
| Sign up / sign in / sign out | Calls the API. The old "any email containing *demo* logs in" shortcut and the "empty database logs anyone in" shortcut are **removed**. |
| 1-Click Evaluation Demo | Signs into one real server-side demo account. It only works when `DEMO_LOGIN_ENABLED=true`, and that account's password is random and unknown. |
| Upload / paste link | The transcript and chapters are still generated in the browser, then saved with `POST /lectures`. YouTube ids and direct video links are saved, so they still play after a refresh. |
| Library, open, delete | `GET /lectures`, `GET /lectures/:id`, `DELETE /lectures/:id` |
| YouTube real-length correction | `PUT /lectures/:id` with the regenerated transcript and chapters |
| Player, transcript sync (binary search), chapters, search, summary, insights | Unchanged. They run in the browser on the loaded lecture. |
| Notes and Markdown export | `GET/POST /lectures/:id/notes`, `DELETE /notes/:id`. Export uses the loaded notes. |
| Quiz and inline "review the moment" player | Unchanged UI. The finished quiz is saved with `POST /quiz-attempts`, and the best score and streak shown come from the server. |
| Flashcards | Piles are loaded and saved with `/progress/flashcards/:id` |
| Dev panel ("what's saved") | Now shows the data returned by `GET /lectures` and `GET /progress` |
| Footer "Reset demo data" | `DELETE /lectures` and `DELETE /progress` for the signed-in user only |

**Migrating CE1 data.** After signing in or signing up with the **same email** as an old browser-only account, the app finds that account's sessions, notes, flashcards and streak in LocalStorage and asks whether to import them. The server:
- validates every lecture on its own
- assigns everything to the signed-in user, ignoring any owner sent by the browser
- skips sessions already imported (unique `legacyId`)
- only imports the streak if the account has no streak yet
- returns a per-record report

The original LocalStorage data is **not deleted**. Once you've checked the imported data in the app, you can clear it with DevTools → Application → Local Storage.

---

## 7. Running locally

### Prerequisites
- Node.js 20 or newer
- MongoDB: either a free MongoDB Atlas cluster, or MongoDB Community Server running locally on `mongodb://127.0.0.1:27017`

### Backend

```bash
cd backend
npm install
cp .env.example .env        # then edit .env (see below)
npm run dev                 # auto-restarts on changes; or: npm start
```

You should see `MongoDB connected …` and `Momento API listening on port 5050`. Check http://localhost:5050/api/health.

> Port **5050** is used instead of 5000 because macOS uses port 5000 for AirPlay Receiver, which answers every request with `403 Forbidden`.

### Environment variables (`backend/.env`)

| Variable | Example | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5050` | API port (Render sets this automatically) |
| `NODE_ENV` | `development` | `production` enables strict CORS and the minimum secret length |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/momento` | Database connection (required) |
| `JWT_SECRET` | 48+ random bytes | Signs login tokens (required; at least 32 characters in production). Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `FRONTEND_URL` | `http://localhost:5500` | Allowed browser origin(s), comma-separated. In development any `http://localhost:*` is also allowed |
| `DEMO_LOGIN_ENABLED` | `true` | Turns on the demo button's endpoint |
| `DEMO_EMAIL` | `student@momento.ai` | Email of the shared demo account |

`.env` is listed in `.gitignore` and must never be committed.

### Frontend

Serve the `frontend/` folder with any static server, for example:
- VS Code **Live Server**: right-click `frontend/index.html` → *Open with Live Server* (port 5500)
- or `npx serve frontend -l 5500`
- or `python3 -m http.server 5500 --directory frontend`

When the page is opened from `localhost`, `js/config.js` automatically uses `http://localhost:5050/api`.

---

## 8. Testing

### Automated tests (real MongoDB, no setup needed)

```bash
cd backend
npm test
```

These 58 tests start a throwaway MongoDB server (`mongodb-memory-server` downloads a real `mongod` binary the first time). They cover:
- signup and login, including that passwords are stored as hashes
- duplicate email and invalid credentials
- logout token invalidation
- full CRUD for lectures and notes
- server-side quiz grading and streak rules
- flashcards
- the LocalStorage migration
- **401/403 checks for every protected resource, including another user's data**
- CORS
- malformed JSON

### Postman / Thunder Client

Import `backend/tests/postman/Momento.postman_collection.json`. Set the `baseUrl` collection variable (local `http://localhost:5050/api`, or the deployed URL), then **run the whole collection in order** with the Collection Runner. Thunder Client can import Postman collections too.

The collection has 42 requests in 7 folders:
1. Health
2. Authentication
3. Lectures
4. Notes
5. Quiz & Progress
6. Another user's data (403s)
7. Delete & logout

Each run registers two new users, so it can be repeated. It can also run from the command line:

```bash
npx newman run backend/tests/postman/Momento.postman_collection.json --env-var baseUrl=http://localhost:5050/api
```

Recorded results of every test run are in [`backend/tests/TEST_RESULTS.md`](backend/tests/TEST_RESULTS.md).

---

## 9. Deployment (Render + MongoDB Atlas)

1. **MongoDB Atlas**
   1. Create a free M0 cluster.
   2. Under *Database Access*, add a user with `readWrite` on the `momento` database.
   3. Under *Network Access*, add your Render service's **outbound IP addresses**. They're listed in the Render dashboard on the service's *Connect → Outbound* tab. Avoid `0.0.0.0/0` unless your host has no fixed outbound IPs.
   4. Copy the connection string (*Connect → Drivers*) and add `/momento` as the database name.
2. **Push** this repository to GitHub.
3. **Render**
   1. Go to *New → Blueprint* and pick this repository. `render.yaml` creates two services:
      - `momento-api`: the Node backend, with its health check on `/api/health` and an auto-generated `JWT_SECRET`
      - `momento`: the static frontend
   2. When asked, enter `MONGODB_URI` (from Atlas) and `FRONTEND_URL` (the static site's URL, e.g. `https://momento.onrender.com`).
4. **Point the frontend at the API.** If the API URL Render gives you isn't `https://momento-api.onrender.com`:
   1. Edit the single line `PRODUCTION_API_URL` in `frontend/js/config.js`.
   2. Commit and push. The static site redeploys.
5. **Verify**
   1. Open `https://<api>/api/health`. It should report `"database": "connected"`.
   2. Run the Postman collection with `baseUrl` set to `https://<api>/api`.
   3. Sign up on the deployed site, add a lecture and a note, then refresh the page.

The free tier sleeps when idle, so the first request after a pause can take 30–50 seconds. The frontend waits up to 45 seconds before reporting a timeout.

The frontend can also be hosted on GitHub Pages or Netlify (publish the `frontend/` folder). If you do that, add its URL to `FRONTEND_URL`.

---

## 10. Security summary

- Passwords are hashed with bcrypt (10 rounds) in a Mongoose pre-save hook. They are never stored in the browser or returned by the API.
- Login returns the same `401 Invalid email or password` for an unknown email and for a wrong password. Unknown emails still run a bcrypt comparison, so response timing doesn't reveal which emails have accounts.
- JWTs are signed with `JWT_SECRET` from the environment and expire after `JWT_EXPIRES_IN`. Logout increments `tokenVersion`, which invalidates the user's earlier tokens.
- The token is kept in **sessionStorage** and sent as a `Bearer` header. Because no cookies are used, there is no CSRF risk, and it works when the frontend and API are on different domains. The trade-off is that a cross-site-scripting bug could read the token. The frontend escapes user content with `escapeHtml()` before rendering it.
- Each controller accepts only a whitelist of fields (`owner` and `bestScore` can't be set by a client), and Mongoose schemas validate the input.
- Auth routes are rate-limited (50 failed attempts per IP per 15 minutes).
- In production, CORS only allows `FRONTEND_URL`.
- The error middleware never sends stack traces. Unexpected errors are logged on the server and return a generic 500.
- `GET /health` reports the connection state only, never the connection string.

---

## 11. Known limitations

- **Media files are not stored.** A local audio or video file is played from a temporary `blob:` URL that only exists in that browser tab. After a refresh or in a new tab, the lecture's transcript, notes, quiz and flashcards are still there, but the file has to be processed again to play it (the app explains this when it happens). YouTube and direct video links do persist. Storing uploads would need cloud file storage (e.g. S3 or Cloudinary), which is outside the CE2 scope.
- **Transcripts and chapters are not real speech recognition or AI.** As in CE1, `generateTranscript()` builds a demonstration transcript from a fixed set of JavaScript-topic sentences, spread across the media's real duration. The chapters, quiz, summary and flashcards are then derived from it by the rule-based algorithms. CE2 stores these results; it doesn't make them more accurate. Some generated quiz questions have no visible blank (for example the topic `async` in a sentence about "Asynchronous JavaScript"). That is existing CE1 behaviour and was left unchanged.
- Streak days are counted as UTC calendar days. Unlike CE1, the streak now actually **restarts** after a missed day, and a quiz must score ≥ 60% to count.
- Logging out ends the user's sessions on every tab and device, because all of their tokens are invalidated together.
- The demo button signs everyone into **one shared** demo account.
- The rate limiter keeps its counts in memory, so they reset when the server restarts.
- `ARCHITECTURE.md` describes a design for processing 10–20 hour recordings with background jobs. That pipeline is **not implemented**.

---

## 12. Core algorithms (frontend, unchanged from CE1)

1. **Binary search sync, O(log n):** `findActiveLineIndex(lines, time)` finds the transcript line being spoken during playback.
2. **Keyword-frequency chapter detection:** `detectChapters(lines)` uses a sliding window over line keywords to mark topic changes.
3. **Rule-based quiz generation:** `generateQuiz(session, length)` builds fill-in-the-blank questions, taking distractors from other topics.
4. **Streak and mastery:** previously `recordStreak(score)` in the browser. It is now `recordStudyDay()` in `backend/src/services/streakService.js`.

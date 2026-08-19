# Momento — Professional Multi-Page Modular Web Application

Momento is an AI-assisted lecture study companion that transforms recorded lectures into interactive, time-synchronized, testable learning experiences where every wrong quiz answer links back to the exact second that explains it.

---

## 📁 Modular Project Structure

```
backend_project/
├── index.html               # Home / Landing Page with Live Sync & Interactive Hub
├── how.html                 # How It Works Page (3 Steps, Visual Flow, 4 Algorithms)
├── app.html                 # Study Tool (Library, Player, Synced Transcript, Quiz, Flashcards, Notes)
├── compare.html             # Why Momento (Feature Comparison Matrix)
├── login.html               # Authentication Portal (Sign In & Sign Up with Live Validation)
├── README.md                # Project Overview & Architecture Guide
├── ARCHITECTURE.md          # Technical Specifications & Data Flow
│
├── css/
│   ├── common.css           # Global Design Tokens, Typography, Site Header, Footer, Toast, Buttons
│   ├── home.css             # Hero, Demo Sync Strip, Podcast Feature Hub, Testimonials
│   ├── how.css              # Step Cards, Pipeline Diagram, Algorithm Cards, FAQ Accordion
│   ├── app.css              # Dropzone, Player Controls, Synced Transcript, Quiz Modal, Flashcards, Notes
│   ├── compare.css          # Comparison Matrix Tables & Cell Indicators
│   └── login.css            # Glassmorphism Auth Card, Inputs, Validation Criteria Checklist
│
└── js/
    ├── common.js            # Shared Utilities ($/$$), Toasts, Mobile Menu, Global Auth & Session Manager
    ├── home.js              # Live Sync Simulation, Interactive Podcast Hub & Audio Telemetry
    ├── how.js               # FAQ Accordion Handlers & Interactive Algorithm Cues
    ├── app.js               # Auth Guard, Media Upload/Link Engine, O(log n) Sync, Quiz, Flashcards, Notes
    ├── compare.js           # Comparison Matrix Interactivity
    └── login.js             # Sign In / Sign Up Forms, Email Regex Validation, Password Rules, Local Storage DB
```

---

## 🗄️ Storage Architecture

| Storage | Key | Description |
| :--- | :--- | :--- |
| **LocalStorage** | `momento_users_v1` | Registered users database `[{id, name, email, password, createdAt}]` |
| **LocalStorage** | `momento_library_v1` | Persistent study sessions, transcripts, chapters, and quiz scores |
| **LocalStorage** | `momento_streak_v1` | Daily study streak tracking `{current, best, lastDate}` |
| **LocalStorage** | `momento_notes_<id>` | Timestamped lecture notes for each specific session |
| **LocalStorage** | `momento_fc_states_<id>` | 3D Flashcard mastery statuses `{known: [], studying: []}` |
| **SessionStorage** | `momento_current_user` | Active logged-in user `{id, name, email}` |
| **SessionStorage** | `momento_blob_<id>` | Active video/audio object URL or YouTube stream reference |

---

## ⚡ 4 Hand-Coded Core Algorithms

1. **Binary Search Sync ($O(\log n)$):** `findActiveLineIndex(lines, time)` finds the active transcript sentence during video playback in $< 2\text{ms}$.
2. **Keyword-Frequency Chapter Detection:** `detectChapters(lines)` analyzes keyword frequencies using a sliding window to automatically delineate lecture topics.
3. **Rule-Based Quiz Synthesis:** `generateQuiz(session, length)` creates fill-in-the-blank questions and selects distractors from other chapters without requiring an external LLM.
4. **Streak & Mastery Engine:** `recordStreak(score)` tracks continuous daily study activity and unlocks mastery badges.

# Momento Backend Architecture & Async Job Contract
*Specification for High-Scale, Long-Duration Audio/Video Ingestion (10–20+ Hours)*

---

## 1. Overview

Processing long media files (such as 10–20 hour lecture series, marathon conference live-streams, or multi-part podcasts) requires asynchronous, distributed processing. Client-side single-request execution fails for such files due to browser memory limits, request timeouts, network instability, and audio decoding constraints.

This document formalizes the **Momento Backend Async Job Contract** for:
- Resumable chunked file upload.
- Distributed per-chunk transcription.
- Timestamp-offset-preserving transcript merging.
- Automated chaptering, cognitive quiz synthesis, genre classification, and recommendations generation.
- Stage-level failure recovery and idempotent resumability.

---

## 2. System Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                  Client Browser                                   |
+-----------------------------------------------------------------------------------+
       | (1) Chunked Upload (5MB-50MB Slices)
       v
+-----------------------------------------------------------------------------------+
|                            API Gateway / Ingestion API                            |
|                  POST /api/v1/jobs/upload-chunk & /jobs/create                    |
+-----------------------------------------------------------------------------------+
       | (2) S3 / GCS Storage Bucket + PubSub / Kafka Event
       v
+-----------------------------------------------------------------------------------+
|                        Job Orchestrator (Temporal / Celery)                       |
+-----------------------------------------------------------------------------------+
   |                    |                      |                      |
   v                    v                      v                      v
[Worker: Slicer]  [Worker Pool: STT]   [Worker: Merger]    [Worker: NLP & Quiz]
- Audio Demux     - Sarvam/Whisper     - Offset Alignment  - Chaptering (Windowed)
- Silence Detection - Parallel Workers  - Boundary Stitch   - 6-Type Cognitive Quiz
- 10-Min Chunks                                             - Genre & Recommendations
       |
       +-------------> Status Polling / WebSocket Push Updates
```

---

## 3. Endpoints & API Contract

Base URL: `https://api.momento.ai/v1`

### 3.1. Initiate Job & Session
**`POST /jobs/initiate`**

Creates a new asynchronous processing session.

**Request Payload:**
```json
{
  "filename": "cs101_full_semester_recording.mp4",
  "totalSizeBytes": 8589934592,
  "chunkSizeBytes": 10485760,
  "totalChunks": 819,
  "mediaType": "video/mp4",
  "estimatedDurationSeconds": 36000,
  "metadata": {
    "title": "CS101 Semester Lecture Archive",
    "studentName": "Aditi Sharma",
    "genreHint": "Education"
  }
}
```

**Response (201 Created):**
```json
{
  "jobId": "job_9f8b2c1a0e",
  "status": "UPLOADING",
  "uploadUrls": [
    { "chunkIndex": 0, "uploadUrl": "https://storage.momento.ai/uploads/job_9f8b2c1a0e/chunk_0.part?sig=..." },
    { "chunkIndex": 1, "uploadUrl": "https://storage.momento.ai/uploads/job_9f8b2c1a0e/chunk_1.part?sig=..." }
  ],
  "createdAt": "2026-08-18T00:25:00Z"
}
```

---

### 3.2. Upload Chunk & Register Part
**`POST /jobs/:jobId/chunk`** (or direct PUT to Signed S3/GCS URL)

**Request Payload:**
```json
{
  "jobId": "job_9f8b2c1a0e",
  "chunkIndex": 42,
  "byteOffset": 440401920,
  "checksumMd5": "d41d8cd98f00b204e9800998ecf8427e"
}
```

**Response (200 OK):**
```json
{
  "jobId": "job_9f8b2c1a0e",
  "chunkIndex": 42,
  "uploadedChunksCount": 43,
  "totalChunks": 819,
  "percentUploaded": 5.25
}
```

---

### 3.3. Job Status Polling
**`GET /jobs/:jobId/status`**

Client polls every 2.5–5 seconds (or receives WebSocket notifications on `/ws/jobs/:jobId`).

**Response (200 OK):**
```json
{
  "jobId": "job_9f8b2c1a0e",
  "status": "TRANSCRIBING",
  "currentStage": "TRANSCRIBING_CHUNKS",
  "progress": {
    "percent": 68.4,
    "stages": {
      "uploading": { "status": "COMPLETED", "progress": 100 },
      "chunking": { "status": "COMPLETED", "progress": 100, "audioChunks": 60 },
      "transcribing": { "status": "IN_PROGRESS", "completedChunks": 41, "totalChunks": 60, "progress": 68.3 },
      "merging": { "status": "PENDING", "progress": 0 },
      "segmenting": { "status": "PENDING", "progress": 0 },
      "quiz_generation": { "status": "PENDING", "progress": 0 },
      "insights_recommendations": { "status": "PENDING", "progress": 0 }
    }
  },
  "error": null,
  "resumable": true,
  "lastHeartbeat": "2026-08-18T00:32:15Z"
}
```

---

### 3.4. Resume / Retry Failed Stage
**`POST /jobs/:jobId/resume`**

Allows client or worker to resume an interrupted job from the exact chunk or pipeline step that failed, without re-uploading or re-transcribing completed chunks.

**Request Payload:**
```json
{
  "resumeFromStage": "transcribing",
  "failedChunkIndex": 42
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "job_9f8b2c1a0e",
  "status": "TRANSCRIBING",
  "resumedAtChunk": 42,
  "message": "Resumed transcription task pool for remaining 19 chunks."
}
```

---

### 3.5. Final Merged Output Retrieval
**`GET /jobs/:jobId/result`**

**Response (200 OK):**
```json
{
  "jobId": "job_9f8b2c1a0e",
  "status": "COMPLETED",
  "durationSeconds": 36000,
  "genre": "Education",
  "summary": "Comprehensive 10-hour lecture series on Advanced Computer Systems...",
  "linesCount": 4200,
  "chaptersCount": 18,
  "quizQuestionsCount": 25,
  "linesUrl": "https://cdn.momento.ai/artifacts/job_9f8b2c1a0e/lines.json",
  "chapters": [
    { "startIndex": 0, "startTime": 0.0, "endTime": 1820.4, "title": "Hardware Architectures & Caches", "keyword": "hardware" }
  ],
  "recommendations": [
    {
      "title": "Advanced Memory Hierarchy Deep Dive",
      "genre": "Education",
      "estDuration": "45m",
      "reason": "Because this covered: hardware, caches, and memory latency"
    }
  ]
}
```

---

## 4. Timestamp Offset Preservation & Stitching Protocol

When splitting a 10–20 hour file into chunks $C_0, C_1, \dots, C_{k-1}$ of duration $D_i$ starting at time offset $T_{\text{offset}}(i)$:

$$\text{Line}_{\text{global}}.\text{start} = T_{\text{offset}}(i) + \text{Line}_{\text{local}}.\text{start}$$
$$\text{Line}_{\text{global}}.\text{end} = T_{\text{offset}}(i) + \text{Line}_{\text{local}}.\text{end}$$

### Boundary Overlap & Deduplication Protocol:
1. Slicer extracts audio with a **2.0-second rolling overlap** to avoid cutting words in half at chunk boundaries.
2. In the Merge Worker, words falling in the overlap interval $[T_{\text{offset}}(i+1) - 2.0, T_{\text{offset}}(i+1)]$ are reconciled using Levenshtein distance alignment.
3. Timestamp monotonic validation ensures:
$$\text{Line}_m.\text{start} \le \text{Line}_{m+1}.\text{start} \quad \text{and} \quad \text{Line}_m.\text{end} \le \text{Line}_{m+1}.\text{end}$$

---

## 5. Failure Recovery & Resumability State Machine

```
[INITIATED] -> [UPLOADING] -> (Network Drop) -> [PAUSED/RESUMABLE] -> (Resume) -> [UPLOADING]
     |
     v
[CHUNKING] -> (Slicer Failure) -> [RETRY CHUNKING]
     |
     v
[TRANSCRIBING] -> (Chunk 42 Timeout) -> [RETRY CHUNK 42] (Chunks 0..41 Preserved)
     |
     v
[MERGING] -> (Timestamp Monotonic Validation)
     |
     v
[SEGMENTING & NLP] -> (Chapter Overlap Validator)
     |
     v
[SYNTHESIS: QUIZ & RECOMMENDATIONS]
     |
     v
[COMPLETED]
```

---

## 6. Client-Side Simulation in Momento (Demo Build)

To prove this architecture and state machine in the current frontend:
1. Media $>2$ hours (or the Long-Media demo toggle) triggers the Staged Progress Simulator.
2. The UI renders each discrete stage: Uploading $\rightarrow$ Chunking $\rightarrow$ Transcribing Chunk $N/M$ $\rightarrow$ Offset Merge $\rightarrow$ Chapters $\rightarrow$ Quiz $\rightarrow$ Insights $\rightarrow$ Recommendations.
3. A simulated stage failure can be triggered or recovered, demonstrating that the client state machine resumes without data loss.
4. Timestamps computed in the client strictly mirror the global offset formula without drift.

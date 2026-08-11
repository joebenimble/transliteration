# Speech-to-Text Web Application PRD

## Product Overview

A password-protected web application that accepts uploaded `.wav` audio files and converts them to text using OpenAI's Whisper speech recognition engine. Users review and edit transcriptions in a memo log before submitting batches to a persistent text file.

## Core Functionality

### File Upload

- **Multi-file upload**: Accept one or more `.wav` files per request
- **File Size Limit**: Only process audio files under one minute in duration
- **Sequential Processing**: Process uploaded files one at a time in queue order

### Speech-to-Text Processing

- **Engine**: OpenAI Whisper CLI on the server
- **Model**: `tiny` (CPU)
- **Processing**: Convert `.wav` files to text transcriptions
- **Failures**: Enqueue memo with empty transcription for manual edit

### File Management

- **Review Queue**: Store draft transcriptions in a pending memo queue until the user submits them
- **Source Files**: Delete uploaded `.wav` files after the user confirms a batch
- **Output File**: Save all submitted transcriptions to `data/transcriptions.txt`
- **Content Format**:
  ```
  [filename.wav]
  [transcribed text content]

  ```

### Authentication

- **Shared password**: Single `APP_PASSWORD` environment variable
- **Session cookie**: Login form sets an authenticated session
- **No OAuth**: No third-party identity providers

## User Interface

### Login Page

- Password form
- Redirect to main app on success

### Main App

- **Upload section**: Multi-select `.wav` upload with in-page queue status
- **Memo Log**: Up to 10 pending memos (FIFO)
  - Play button for each memo's WAV (streamed from server)
  - Editable transcription textarea
  - Submit batch to save and delete source files
- **Download**: Link to `transcriptions.txt`
- **Logout**: End session

### Notifications

- None in v1. Users refresh or rely on auto-polling status in the memo log area.

## Technical Requirements

### Platform

- **Runtime**: Node.js 20+ with Express
- **Transcription**: Python Whisper + FFmpeg in Docker container
- **Hosting**: GitHub Codespaces (dev), Railway or Render (production)
- **Persistence**: Volume-mounted `data/` directory

### Application Behavior

- **Processing Queue**: Handle files sequentially, one at a time
- **Offline transcription**: No external API calls (local Whisper)

## Processing Workflow

1. User uploads one or more `.wav` files
2. Each file is enqueued for processing
3. Validate file duration (skip if over one minute)
4. Process file through Whisper
5. Add draft transcription to pending memo queue
6. User reviews up to 10 pending memos in the memo log
7. User plays audio, edits text, and submits the batch
8. Append submitted results to `transcriptions.txt`
9. Delete submitted `.wav` files
10. Load the next batch of pending memos

## Success Criteria

- Successfully processes `.wav` files under one minute
- Accurate transcription using Whisper
- Multi-file upload and sequential queue processing
- Memo log supports playback, editing, and batch submission
- Password protection on all app routes
- Data persists across restarts via mounted volume

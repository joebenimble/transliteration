# Speech-to-Text Desktop Application PRD

## Product Overview
A desktop application built with Electron that automatically monitors a specified folder for new .wav audio files and converts them to text using OpenAI's Whisper speech recognition engine. The application runs on Windows and provides a simple system tray interface with basic configuration options.

## Core Functionality

### File Monitoring
- **Folder Watching**: Monitor a user-specified folder for .wav files
- **File Events**: Detect when files are added, modified, or replaced in the watched folder
- **File Processing**: Process .wav files one at a time in the order they appear
- **File Size Limit**: Only process audio files under one minute in duration

### Speech-to-Text Processing
- **Engine**: Use OpenAI Whisper for offline speech recognition
- **Model**: Bundle Whisper locally with an appropriate model size optimized for Core i9 processors (recommend "small" or "medium" model for balance of speed and accuracy)
- **Processing**: Convert .wav files to text transcriptions

### File Management
- **Review Queue**: Store draft transcriptions in a pending memo queue until the user submits them
- **Source Files**: Move submitted .wav files to Windows Recycle Bin after the user confirms the batch
- **Output File**: Save all submitted transcriptions to a single file named `transcriptions.txt` in the watched folder
- **File Format**: Plain text file
- **Content Format**: Each transcription should include the original filename followed by the transcribed text
- **File Handling**: Append new transcriptions to existing file; create file if it doesn't exist

### Error Handling
- **Failed Processing**: Enqueue memo with empty transcription so the user can listen and edit manually
- **No Validation**: No need to validate that .wav files are properly formatted

## User Interface Requirements

### System Tray
- **Presence**: Application icon in Windows system tray
- **Basic Controls**: Right-click context menu with options to:
  - Open Memo Log window
  - Open configuration window
  - Exit application
- **Status Indicator**: Visual indication of application status (watching/idle)

### Memo Log Window
- **Purpose**: Review pending transcriptions before saving
- **Batch Size**: Show up to 10 pending memos at a time in FIFO order
- **Audio Playback**: Play button for each memo's original .wav file
- **Editable Text**: User can edit each draft transcription
- **Submit Action**: Write the current batch to transcriptions.txt and move associated .wav files to Recycle Bin
- **Edit Persistence**: Save textarea edits back to the pending memo store

### Configuration Window
- **Purpose**: Settings configuration only
- **Folder Selection**: Browse and select folder to watch
- **Auto-Start**: Automatically begin watching when folder is selected
- **Settings Persistence**: Remember selected folder between application sessions
- **Minimal Interface**: Simple, clean interface focused on folder selection

### Notifications
- **Review Alerts**: Windows toast notification when a memo is ready for review
- **No Real-time Status**: No need for real-time processing updates

## Technical Requirements

### Platform
- **Operating System**: Windows only
- **Framework**: Electron
- **Dependencies**: Bundle Whisper locally (no external API calls required)

### Application Behavior
- **Startup**: Manual launch (do not auto-start with Windows)
- **Initial State**: If folder was previously configured, start watching immediately on launch
- **Processing Queue**: Handle files sequentially, one at a time
- **Offline Operation**: Full functionality without internet connection

### Performance
- **Target Hardware**: Optimized for Core i9 processors
- **Processing Limit**: Audio files under one minute duration
- **Resource Usage**: Efficient file watching without excessive system resource consumption

## Detailed Specifications

### File Watching Logic
1. Monitor specified folder for file system events
2. Filter for .wav file extensions
3. Trigger processing for new, modified, or replaced .wav files
4. Queue files if multiple arrive simultaneously

### Processing Workflow
1. Detect new .wav file in watched folder
2. Validate file duration (skip if over one minute)
3. Process file through Whisper speech-to-text
4. Add draft transcription to pending memo queue
5. Display Windows toast notification that the memo is ready for review
6. User opens Memo Log and reviews up to 10 pending memos
7. User plays each .wav file and edits the transcription if needed
8. User submits the current batch
9. Append submitted results to transcriptions.txt with format:
   ```
   [filename.wav]
   [transcribed text content]
   
   ```
10. Move submitted .wav files to Recycle Bin
11. Load the next batch of up to 10 pending memos

### Configuration Persistence
- Store settings in Electron's userData directory
- Save watched folder path between sessions
- Persist pending memo queue in Electron's userData directory
- Restore application state on startup

### Error Scenarios
- **Processing Failure**: Enqueue memo with empty transcription so the user can listen and edit manually
- **File Access Issues**: Handle locked or in-use files gracefully
- **Missing Whisper**: Graceful degradation if Whisper dependencies are missing

## User Experience Flow

### First Launch
1. User launches application
2. System tray icon appears
3. Configuration window opens automatically (no folder selected)
4. User selects folder to watch
5. Application begins monitoring immediately

### Normal Operation
1. User launches application
2. Application starts watching previously configured folder
3. When .wav file appears in folder:
   - File is processed automatically
   - Draft transcription is added to the pending memo queue
   - Toast notification confirms the memo is ready for review
4. User opens Memo Log from the system tray
5. User reviews up to 10 memos, plays audio, edits text, and submits the batch
6. Submitted transcriptions are appended to transcriptions.txt
7. Submitted .wav files move to Recycle Bin

### Configuration Changes
1. User right-clicks system tray icon
2. Selects "Configuration" or "Settings"
3. Configuration window opens
4. User selects new folder
5. Watching switches to new folder immediately

## Success Criteria
- ✅ Successfully processes .wav files under one minute
- ✅ Accurate transcription using Whisper
- ✅ Reliable file watching and management
- ✅ Memo Log supports playback, editing, and batch submission
- ✅ Clean, intuitive configuration interface
- ✅ Stable system tray operation
- ✅ Proper Windows integration (notifications, recycle bin)
- ✅ Settings persistence between sessions
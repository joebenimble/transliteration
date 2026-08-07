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
- **Source Files**: Move processed .wav files to Windows Recycle Bin after successful transcription
- **Output File**: Save all transcriptions to a single file named `transcriptions.txt` in the watched folder
- **File Format**: Plain text file
- **Content Format**: Each transcription should include the original filename followed by the transcribed text
- **File Handling**: Append new transcriptions to existing file; create file if it doesn't exist

### Error Handling
- **Failed Processing**: Leave .wav files in place if Whisper processing fails
- **No Validation**: No need to validate that .wav files are properly formatted

## User Interface Requirements

### System Tray
- **Presence**: Application icon in Windows system tray
- **Basic Controls**: Right-click context menu with options to:
  - Open configuration window
  - Exit application
- **Status Indicator**: Visual indication of application status (watching/idle)

### Configuration Window
- **Purpose**: Settings configuration only
- **Folder Selection**: Browse and select folder to watch
- **Auto-Start**: Automatically begin watching when folder is selected
- **Settings Persistence**: Remember selected folder between application sessions
- **Minimal Interface**: Simple, clean interface focused on folder selection

### Notifications
- **Completion Alerts**: Windows toast notification when file processing completes
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
4. Append result to transcriptions.txt with format:
   ```
   [filename.wav]
   [transcribed text content]
   
   ```
5. Move original .wav file to Recycle Bin
6. Display Windows toast notification of completion

### Configuration Persistence
- Store settings in Electron's userData directory
- Save watched folder path between sessions
- Restore application state on startup

### Error Scenarios
- **Processing Failure**: Leave .wav file in original location, log error internally
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
   - Transcription is appended to transcriptions.txt
   - Original file moves to Recycle Bin
   - Toast notification confirms completion

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
- ✅ Clean, intuitive configuration interface
- ✅ Stable system tray operation
- ✅ Proper Windows integration (notifications, recycle bin)
- ✅ Settings persistence between sessions
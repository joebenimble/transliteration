# Speech-to-Text Desktop Application

A Windows desktop application built with Electron that automatically monitors a folder for .wav audio files and converts them to text using OpenAI's Whisper speech recognition engine.

## Features

- **Automatic File Monitoring**: Watches a specified folder for new .wav files
- **Offline Speech Recognition**: Uses Whisper locally for transcription
- **System Tray Integration**: Runs quietly in the background with tray icon
- **Memo Log Review**: Review, play, and edit transcriptions before saving
- **Batch Submission**: Submit up to 10 reviewed memos at a time
- **File Management**: Moves submitted files to Recycle Bin after review
- **Persistent Settings**: Remembers your folder selection between sessions
- **Windows Notifications**: Toast notifications when a memo is ready for review

## Prerequisites

Before running the application, you need to install:

1. **Node.js** (version 16 or higher)
2. **Whisper** - Install using pip:
   ```bash
   pip install openai-whisper
   ```
3. **FFmpeg** (for audio duration checking):
   - Download from https://ffmpeg.org/download.html
   - Add to your system PATH

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the application:
   ```bash
   npm start
   ```

2. The application will appear in your system tray
3. Right-click the tray icon and select "Configuration"
4. Choose a folder to monitor for .wav files
5. The application will automatically start watching the selected folder

## How It Works

1. Drop a .wav file into your monitored folder
2. The application detects the new file
3. If the audio is under 60 seconds, it gets processed by Whisper
4. The draft transcription is added to the Memo Log queue
5. Open Memo Log from the system tray to review up to 10 memos at a time
6. Play each WAV, edit the transcription if needed, then click Submit
7. Submitted transcriptions are appended to `transcriptions.txt` in the watched folder
8. The original .wav files for submitted memos are moved to the Recycle Bin
9. You receive a notification when a memo is ready for review

## File Format

Transcriptions are saved in the following format in `transcriptions.txt`:

```
[filename.wav]
Transcribed text content here...

[another-file.wav]
More transcribed content...
```

## Limitations

- Only processes .wav files under 60 seconds in duration
- Windows only
- Requires Whisper and FFmpeg to be installed and available in PATH

## Development

To run in development mode:
```bash
npm run dev
```

To build for distribution:
```bash
npm run build
```

## Troubleshooting

- **Whisper not found**: Ensure Whisper is installed and available in your PATH
- **FFmpeg not found**: Install FFmpeg and add it to your system PATH
- **Files not processing**: Check that files are actually .wav format and under 60 seconds
- **No notifications**: Ensure Windows notifications are enabled for the application
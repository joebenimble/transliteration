const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function getWhisperCommand() {
  const python = process.env.WHISPER_PYTHON || 'python3';
  return {
    command: python,
    argsPrefix: ['-m', 'whisper']
  };
}

class ProcessingQueue {
  constructor(memoStore) {
    this.memoStore = memoStore;
    this.queue = [];
    this.isProcessing = false;
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length
    };
  }

  enqueue(filePath, filename) {
    if (!this.queue.some((item) => item.filePath === filePath)) {
      this.queue.push({ filePath, filename });
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { filePath, filename } = this.queue.shift();

    try {
      await this.processAudioFile(filePath, filename);
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error);
    }

    this.isProcessing = false;
    this.processQueue();
  }

  async processAudioFile(filePath, filename) {
    console.log(`Processing: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      const duration = await this.getAudioDuration(filePath);
      if (duration > 60) {
        console.log(`Skipping ${filePath} - duration ${duration}s exceeds 60 seconds`);
        this.memoStore.deleteUploadedFile(filePath);
        return;
      }

      let transcription = '';
      try {
        transcription = await this.transcribeAudio(filePath);
      } catch (error) {
        console.error(`Transcription failed for ${filePath}:`, error.message);
      }

      this.memoStore.addPendingMemo(filePath, filename, transcription);
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error.message);
    }
  }

  getAudioDuration(filePath) {
    return new Promise((resolve) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        filePath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          resolve(parseFloat(output.trim()));
        } else {
          resolve(0);
        }
      });

      ffprobe.on('error', () => resolve(0));
    });
  }

  findTranscriptionFile(tempDir, filePath, startedAt) {
    const baseName = path.basename(filePath, path.extname(filePath));
    const candidates = [
      path.join(tempDir, `${baseName}.txt`),
      path.join(tempDir, `${path.basename(filePath)}.txt`),
      path.join(tempDir, `${baseName}.wav.txt`)
    ];

    for (const txtFilePath of candidates) {
      if (fs.existsSync(txtFilePath)) {
        return txtFilePath;
      }
    }

    try {
      const txtFiles = fs.readdirSync(tempDir)
        .filter((name) => name.endsWith('.txt'))
        .map((name) => path.join(tempDir, name))
        .filter((txtPath) => fs.statSync(txtPath).mtimeMs >= startedAt - 1000)
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

      return txtFiles[0] || null;
    } catch {
      return null;
    }
  }

  transcribeAudio(filePath) {
    return new Promise((resolve, reject) => {
      const tempDir = os.tmpdir();
      const startedAt = Date.now();
      const { command, argsPrefix } = getWhisperCommand();
      const model = process.env.WHISPER_MODEL || 'tiny';

      console.log(`Starting Whisper transcription for: ${filePath}`);

      const whisper = spawn(command, [
        ...argsPrefix,
        path.resolve(filePath),
        '--model', model,
        '--output_format', 'txt',
        '--output_dir', tempDir,
        '--verbose', 'False',
        '--fp16', 'False'
      ]);

      let output = '';
      let error = '';

      whisper.stdout.on('data', (data) => {
        output += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        error += data.toString();
      });

      whisper.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper failed with code ${code}: ${error || output}`));
          return;
        }

        const foundFile = this.findTranscriptionFile(tempDir, filePath, startedAt);

        if (!foundFile) {
          reject(new Error(`No transcription output found. ${error || output}`));
          return;
        }

        const transcription = fs.readFileSync(foundFile, 'utf8').trim();

        if (transcription.includes('FileNotFoundError') || transcription.includes('Skipping')) {
          reject(new Error(`Transcription failed: ${transcription}`));
          return;
        }

        try {
          fs.unlinkSync(foundFile);
        } catch {
          console.log('Could not delete temp file:', foundFile);
        }

        resolve(transcription);
      });

      whisper.on('error', (err) => {
        reject(new Error(`Failed to start whisper (${command} ${argsPrefix.join(' ')}): ${err.message}`));
      });
    });
  }
}

module.exports = { ProcessingQueue };

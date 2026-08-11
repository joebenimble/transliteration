const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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
        console.log(`Skipping ${filePath} - duration exceeds 60 seconds`);
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

  transcribeAudio(filePath) {
    return new Promise((resolve, reject) => {
      const tempDir = os.tmpdir();
      console.log(`Starting Whisper transcription for: ${filePath}`);

      const whisper = spawn('whisper', [
        path.resolve(filePath),
        '--model', 'tiny',
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
        if (code === 0) {
          const baseName = path.basename(filePath, path.extname(filePath));
          const possibleFiles = [
            path.join(tempDir, baseName + '.txt'),
            path.join(tempDir, path.basename(filePath) + '.txt'),
            path.join(tempDir, baseName + '.wav.txt')
          ];

          let transcription = null;
          let foundFile = null;

          for (const txtFilePath of possibleFiles) {
            try {
              if (fs.existsSync(txtFilePath)) {
                transcription = fs.readFileSync(txtFilePath, 'utf8').trim();
                foundFile = txtFilePath;
                break;
              }
            } catch {
              continue;
            }
          }

          if (transcription && !transcription.includes('FileNotFoundError') && !transcription.includes('Skipping')) {
            try {
              fs.unlinkSync(foundFile);
            } catch {
              console.log('Could not delete temp file:', foundFile);
            }
            resolve(transcription);
          } else {
            const errorMsg = transcription || error || 'No transcription output found';
            reject(new Error(`Transcription failed: ${errorMsg}`));
          }
        } else {
          reject(new Error(`Whisper failed with code ${code}: ${error}`));
        }
      });

      whisper.on('error', (err) => {
        reject(new Error(`Failed to start whisper: ${err.message}`));
      });
    });
  }
}

module.exports = { ProcessingQueue };

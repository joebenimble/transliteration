const { app, BrowserWindow, Tray, Menu, dialog, Notification, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const chokidar = require('chokidar');
const { spawn } = require('child_process');

const MEMO_PAGE_SIZE = 10;

class SpeechToTextApp {
  constructor() {
    this.tray = null;
    this.configWindow = null;
    this.memoLogWindow = null;
    this.watcher = null;
    this.watchedFolder = null;
    this.isProcessing = false;
    this.processingQueue = [];
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.pendingMemosPath = path.join(app.getPath('userData'), 'pending-memos.json');
    this.pendingMemos = { memos: [] };

    this.loadSettings();
    this.loadPendingMemos();
  }

  async init() {
    await app.whenReady();
    this.createTray();

    if (this.watchedFolder && fs.existsSync(this.watchedFolder)) {
      this.startWatching();
    } else {
      this.showConfigWindow();
    }
  }

  createTray() {
    const iconPath = path.join(__dirname, '../assets/icon.png');
    try {
      this.tray = new Tray(iconPath);
    } catch (error) {
      console.log('Could not load icon, using default');
      this.tray = new Tray(require('electron').nativeImage.createEmpty());
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Memo Log',
        click: () => this.showMemoLogWindow()
      },
      {
        label: 'Configuration',
        click: () => this.showConfigWindow()
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',
        click: () => app.quit()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Speech to Text - Idle');
    this.updateTrayStatus('idle');
  }

  updateTrayStatus(status) {
    const tooltip = status === 'watching' ?
      `Speech to Text - Watching: ${path.basename(this.watchedFolder)}` :
      'Speech to Text - Idle';
    this.tray.setToolTip(tooltip);
  }

  showConfigWindow() {
    if (this.configWindow) {
      this.configWindow.focus();
      return;
    }

    this.configWindow = new BrowserWindow({
      width: 500,
      height: 300,
      show: false,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.configWindow.loadFile(path.join(__dirname, 'config.html'));

    this.configWindow.once('ready-to-show', () => {
      this.configWindow.show();
    });

    this.configWindow.on('closed', () => {
      this.configWindow = null;
    });
  }

  showMemoLogWindow() {
    if (this.memoLogWindow) {
      this.memoLogWindow.focus();
      return;
    }

    this.memoLogWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.memoLogWindow.loadFile(path.join(__dirname, 'memo-log.html'));

    this.memoLogWindow.once('ready-to-show', () => {
      this.memoLogWindow.show();
    });

    this.memoLogWindow.on('closed', () => {
      this.memoLogWindow = null;
    });
  }

  notifyMemoLogUpdated() {
    if (this.memoLogWindow && !this.memoLogWindow.isDestroyed()) {
      this.memoLogWindow.webContents.send('memos-updated');
    }
  }

  loadPendingMemos() {
    try {
      if (fs.existsSync(this.pendingMemosPath)) {
        const data = JSON.parse(fs.readFileSync(this.pendingMemosPath, 'utf8'));
        this.pendingMemos = {
          memos: Array.isArray(data.memos) ? data.memos : []
        };
      }
    } catch (error) {
      console.error('Failed to load pending memos:', error);
      this.pendingMemos = { memos: [] };
    }
  }

  savePendingMemos() {
    try {
      fs.writeFileSync(
        this.pendingMemosPath,
        JSON.stringify(this.pendingMemos, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save pending memos:', error);
    }
  }

  addPendingMemo(filePath, transcription) {
    const memo = {
      id: crypto.randomUUID(),
      wavPath: filePath,
      filename: path.basename(filePath),
      transcription: transcription || '',
      createdAt: new Date().toISOString()
    };

    this.pendingMemos.memos.push(memo);
    this.savePendingMemos();
    this.notifyMemoLogUpdated();
    return memo;
  }

  updatePendingMemoText(id, transcription) {
    const memo = this.pendingMemos.memos.find((item) => item.id === id);
    if (!memo) {
      return false;
    }

    memo.transcription = transcription;
    this.savePendingMemos();
    return true;
  }

  getMemoPage() {
    const totalRemaining = this.pendingMemos.memos.length;
    const memos = this.pendingMemos.memos.slice(0, MEMO_PAGE_SIZE).map((memo) => ({
      id: memo.id,
      wavPath: memo.wavPath,
      filename: memo.filename,
      transcription: memo.transcription,
      createdAt: memo.createdAt
    }));

    return {
      memos,
      totalRemaining
    };
  }

  async submitPendingMemos(submissions) {
    if (!this.watchedFolder) {
      throw new Error('No watched folder configured');
    }

    const submittedIds = submissions.map((item) => item.id);
    const pageMemos = this.pendingMemos.memos.slice(0, MEMO_PAGE_SIZE);
    const pageIds = new Set(pageMemos.map((memo) => memo.id));

    for (const submission of submissions) {
      if (!pageIds.has(submission.id)) {
        throw new Error(`Memo ${submission.id} is not on the current page`);
      }
    }

    for (const submission of submissions) {
      const memo = pageMemos.find((item) => item.id === submission.id);
      if (!memo) {
        continue;
      }

      const transcription = submission.transcription || '';
      await this.saveTranscription(memo.wavPath, transcription);

      if (fs.existsSync(memo.wavPath)) {
        await this.moveToRecycleBin(memo.wavPath);
      }
    }

    this.pendingMemos.memos = this.pendingMemos.memos.filter(
      (memo) => !submittedIds.includes(memo.id)
    );
    this.savePendingMemos();
    this.notifyMemoLogUpdated();

    return this.getMemoPage();
  }

  async selectFolder() {
    const result = await dialog.showOpenDialog(this.configWindow, {
      properties: ['openDirectory'],
      title: 'Select folder to watch for .wav files'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      this.watchedFolder = result.filePaths[0];
      this.saveSettings();
      this.startWatching();
      if (this.configWindow) {
        this.configWindow.close();
      }
      return this.watchedFolder;
    }
    return null;
  }

  startWatching() {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = chokidar.watch(path.join(this.watchedFolder, '*.wav'), {
      ignored: /[\/\\]\./,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('add', (filePath) => this.queueFile(filePath));
    this.watcher.on('change', (filePath) => this.queueFile(filePath));

    this.updateTrayStatus('watching');
    console.log(`Watching folder: ${this.watchedFolder}`);
  }

  queueFile(filePath) {
    if (!this.processingQueue.includes(filePath)) {
      this.processingQueue.push(filePath);
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const filePath = this.processingQueue.shift();

    try {
      await this.processAudioFile(filePath);
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error);
    }

    this.isProcessing = false;
    this.processQueue();
  }

  async processAudioFile(filePath) {
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
        return;
      }

      let transcription = '';
      try {
        transcription = await this.transcribeAudio(filePath);
      } catch (error) {
        console.error(`Transcription failed for ${filePath}:`, error.message);
      }

      this.addPendingMemo(filePath, transcription);
      this.showNotification(`Ready for review: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error.message);
    }
  }

  async getAudioDuration(filePath) {
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
          const duration = parseFloat(output.trim());
          resolve(duration);
        } else {
          resolve(0);
        }
      });

      ffprobe.on('error', () => resolve(0));
    });
  }

  async transcribeAudio(filePath) {
    return new Promise((resolve, reject) => {
      const tempDir = require('os').tmpdir();
      console.log(`Starting Whisper transcription for: ${filePath}`);
      console.log(`Output directory: ${tempDir}`);

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
        console.log(`Whisper process ended with code: ${code}`);
        console.log(`Stdout: ${output}`);
        console.log(`Stderr: ${error}`);

        if (code === 0) {
          const baseName = path.basename(filePath, path.extname(filePath));
          const possibleFiles = [
            path.join(tempDir, baseName + '.txt'),
            path.join(tempDir, path.basename(filePath) + '.txt'),
            path.join(tempDir, baseName + '.wav.txt')
          ];

          console.log(`Looking for output files: ${possibleFiles.join(', ')}`);

          let transcription = null;
          let foundFile = null;

          for (const txtFilePath of possibleFiles) {
            try {
              if (fs.existsSync(txtFilePath)) {
                transcription = fs.readFileSync(txtFilePath, 'utf8').trim();
                foundFile = txtFilePath;
                console.log(`Found transcription in: ${txtFilePath}`);
                break;
              }
            } catch (err) {
              continue;
            }
          }

          if (transcription && !transcription.includes('FileNotFoundError') && !transcription.includes('Skipping')) {
            try {
              fs.unlinkSync(foundFile);
            } catch (err) {
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
    });
  }

  async saveTranscription(filePath, transcription) {
    const outputFile = path.join(this.watchedFolder, 'transcriptions.txt');
    const filename = path.basename(filePath);
    const entry = `[${filename}]\n${transcription}\n\n`;

    fs.appendFileSync(outputFile, entry, 'utf8');
  }

  async moveToRecycleBin(filePath) {
    const { shell } = require('electron');
    try {
      await shell.trashItem(filePath);
    } catch (error) {
      console.error(`Failed to move ${filePath} to recycle bin:`, error);
    }
  }

  showNotification(message) {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Speech to Text',
        body: message,
        icon: path.join(__dirname, '../assets/icon.png')
      }).show();
    }
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
        this.watchedFolder = settings.watchedFolder;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  saveSettings() {
    try {
      const settings = {
        watchedFolder: this.watchedFolder
      };
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
}

let speechApp;

app.whenReady().then(() => {
  speechApp = new SpeechToTextApp();
  global.speechApp = speechApp;
  speechApp.init();

  ipcMain.handle('select-folder', () => speechApp.selectFolder());
  ipcMain.handle('get-current-folder', () => speechApp.watchedFolder);
  ipcMain.handle('get-memo-page', () => speechApp.getMemoPage());
  ipcMain.handle('update-memo-text', (_event, id, transcription) =>
    speechApp.updatePendingMemoText(id, transcription)
  );
  ipcMain.handle('submit-memo-page', (_event, submissions) =>
    speechApp.submitPendingMemos(submissions)
  );
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('before-quit', () => {
  if (global.speechApp && global.speechApp.watcher) {
    global.speechApp.watcher.close();
  }
});

const { app, BrowserWindow, Tray, Menu, dialog, Notification, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { spawn } = require('child_process');

class SpeechToTextApp {
  constructor() {
    this.tray = null;
    this.configWindow = null;
    this.watcher = null;
    this.watchedFolder = null;
    this.isProcessing = false;
    this.processingQueue = [];
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    
    this.loadSettings();
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
    
    // Check if file exists and is accessible
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    // Wait a moment to ensure file is not locked
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const duration = await this.getAudioDuration(filePath);
      if (duration > 60) {
        console.log(`Skipping ${filePath} - duration exceeds 60 seconds`);
        return;
      }

      const transcription = await this.transcribeAudio(filePath);
      if (transcription && transcription.trim()) {
        await this.saveTranscription(filePath, transcription);
        await this.moveToRecycleBin(filePath);
        this.showNotification(`Transcription completed: ${path.basename(filePath)}`);
      } else {
        console.log(`Empty transcription for ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error.message);
      // Don't move the file if processing failed
    }
  }

  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
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
      
      // Use absolute paths and disable FP16 for CPU
      const whisper = spawn('whisper', [
        path.resolve(filePath),
        '--model', 'tiny',
        '--output_format', 'txt',
        '--output_dir', tempDir,
        '--verbose', 'False',
        '--fp16', 'False'  // Disable FP16 to avoid the warning and potential issues
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
          // Try multiple possible output file names
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
            // If no valid transcription found, reject with error
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

app.whenReady().then(() => {
  const speechApp = new SpeechToTextApp();
  speechApp.init();

  ipcMain.handle('select-folder', () => speechApp.selectFolder());
  ipcMain.handle('get-current-folder', () => speechApp.watchedFolder);
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('before-quit', () => {
  if (global.speechApp && global.speechApp.watcher) {
    global.speechApp.watcher.close();
  }
});
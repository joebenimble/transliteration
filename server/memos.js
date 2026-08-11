const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMO_PAGE_SIZE = 10;

class MemoStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.uploadsDir = path.join(dataDir, 'uploads');
    this.pendingMemosPath = path.join(dataDir, 'pending-memos.json');
    this.transcriptionsPath = path.join(dataDir, 'transcriptions.txt');
    this.pendingMemos = { memos: [] };

    fs.mkdirSync(this.uploadsDir, { recursive: true });
    this.loadPendingMemos();
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
    fs.writeFileSync(
      this.pendingMemosPath,
      JSON.stringify(this.pendingMemos, null, 2),
      'utf8'
    );
  }

  addPendingMemo(filePath, filename, transcription) {
    const memo = {
      id: crypto.randomUUID(),
      wavPath: filePath,
      filename,
      transcription: transcription || '',
      createdAt: new Date().toISOString()
    };

    this.pendingMemos.memos.push(memo);
    this.savePendingMemos();
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

  getMemoById(id) {
    return this.pendingMemos.memos.find((item) => item.id === id) || null;
  }

  getMemoPage() {
    const totalRemaining = this.pendingMemos.memos.length;
    const memos = this.pendingMemos.memos.slice(0, MEMO_PAGE_SIZE).map((memo) => ({
      id: memo.id,
      filename: memo.filename,
      transcription: memo.transcription,
      createdAt: memo.createdAt
    }));

    return { memos, totalRemaining };
  }

  saveTranscription(filename, transcription) {
    const entry = `[${filename}]\n${transcription}\n\n`;
    fs.appendFileSync(this.transcriptionsPath, entry, 'utf8');
  }

  deleteUploadedFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to delete ${filePath}:`, error);
    }
  }

  deleteMemo(id) {
    const index = this.pendingMemos.memos.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    const memo = this.pendingMemos.memos[index];
    this.deleteUploadedFile(memo.wavPath);
    this.pendingMemos.memos.splice(index, 1);
    this.savePendingMemos();
    return true;
  }

  resetTranscriptionsFile() {
    if (fs.existsSync(this.transcriptionsPath)) {
      fs.unlinkSync(this.transcriptionsPath);
    }
  }

  submitPendingMemos(submissions) {
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
      this.saveTranscription(memo.filename, transcription);
      this.deleteUploadedFile(memo.wavPath);
    }

    this.pendingMemos.memos = this.pendingMemos.memos.filter(
      (memo) => !submittedIds.includes(memo.id)
    );
    this.savePendingMemos();

    return this.getMemoPage();
  }
}

module.exports = { MemoStore, MEMO_PAGE_SIZE };

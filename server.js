const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const pdfParse = require('pdf-parse');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('./thesis_defense.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Database connected');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nim TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      no_hp TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS thesis_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS defense_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      thesis_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      final_score REAL,
      status TEXT DEFAULT 'ongoing',
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (thesis_id) REFERENCES thesis_uploads(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      message TEXT NOT NULL,
      evaluation TEXT,
      score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES defense_sessions(id)
    )
  `);
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && (mimetype || file.mimetype === 'text/plain')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'));
    }
  }
});

// API Routes

// Student Registration
app.post('/api/register', (req, res) => {
  const { nim, nama, no_hp } = req.body;

  if (!nim || !nama || !no_hp) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  const query = 'INSERT INTO students (nim, nama, no_hp) VALUES (?, ?, ?)';
  db.run(query, [nim, nama, no_hp], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed: students.nim')) {
        return res.status(400).json({ error: 'NIM sudah terdaftar' });
      }
      if (err.message.includes('UNIQUE constraint failed: students.no_hp')) {
        return res.status(400).json({ error: 'Nomor HP sudah terdaftar' });
      }
      return res.status(500).json({ error: 'Error saat mendaftar' });
    }

    res.json({
      success: true,
      message: 'Registrasi berhasil',
      studentId: this.lastID
    });
  });
});

// Student Login
app.post('/api/login', (req, res) => {
  const { nim } = req.body;

  if (!nim) {
    return res.status(400).json({ error: 'NIM harus diisi' });
  }

  const query = 'SELECT * FROM students WHERE nim = ?';
  db.get(query, [nim], (err, student) => {
    if (err) {
      return res.status(500).json({ error: 'Error saat login' });
    }
    if (!student) {
      return res.status(404).json({ error: 'Mahasiswa tidak ditemukan' });
    }

    res.json({ success: true, student });
  });
});

// Upload Thesis
app.post('/api/upload-thesis', upload.single('thesis'), async (req, res) => {
  try {
    const { studentId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File tidak ditemukan' });
    }

    let content = '';

    // Extract text from file
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      content = pdfData.text;
    } else if (file.mimetype === 'text/plain') {
      content = fs.readFileSync(file.path, 'utf8');
    }

    const query = 'INSERT INTO thesis_uploads (student_id, filename, content) VALUES (?, ?, ?)';
    db.run(query, [studentId, file.originalname, content], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error saat menyimpan file' });
      }

      res.json({
        success: true,
        message: 'File berhasil diupload',
        thesisId: this.lastID
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error saat mengupload file' });
  }
});

// Get student's thesis files
app.get('/api/thesis/:studentId', (req, res) => {
  const { studentId } = req.params;

  const query = 'SELECT id, filename, uploaded_at FROM thesis_uploads WHERE student_id = ? ORDER BY uploaded_at DESC';
  db.all(query, [studentId], (err, theses) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil data skripsi' });
    }
    res.json({ success: true, theses });
  });
});

// Start Defense Session
app.post('/api/start-defense', (req, res) => {
  const { studentId, thesisId } = req.body;

  const query = 'INSERT INTO defense_sessions (student_id, thesis_id) VALUES (?, ?)';
  db.run(query, [studentId, thesisId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error memulai sidang' });
    }

    // Get thesis content for AI
    db.get('SELECT content FROM thesis_uploads WHERE id = ?', [thesisId], (err, thesis) => {
      if (err || !thesis) {
        return res.status(500).json({ error: 'Error mengambil data skripsi' });
      }

      res.json({
        success: true,
        sessionId: this.lastID,
        thesisContent: thesis.content.substring(0, 2000) // Send preview
      });
    });
  });
});

// Generate AI Question
app.post('/api/generate-question', async (req, res) => {
  try {
    const { sessionId, thesisContent, previousMessages } = req.body;

    // Simple AI question generation (you can integrate with OpenAI, Gemini, etc.)
    const questions = generateQuestion(thesisContent, previousMessages);

    // Save AI message
    const query = 'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)';
    db.run(query, [sessionId, 'dosen', questions], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error menyimpan pertanyaan' });
      }

      res.json({
        success: true,
        question: questions,
        messageId: this.lastID
      });
    });
  } catch (error) {
    console.error('Question generation error:', error);
    res.status(500).json({ error: 'Error menghasilkan pertanyaan' });
  }
});

// Submit Student Answer
app.post('/api/submit-answer', async (req, res) => {
  try {
    const { sessionId, answer, thesisContent } = req.body;

    // Save student answer
    const query = 'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)';
    db.run(query, [sessionId, 'mahasiswa', answer], async function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error menyimpan jawaban' });
      }

      // Evaluate answer
      const evaluation = await evaluateAnswer(answer, thesisContent);

      // Update message with evaluation
      db.run(
        'UPDATE chat_messages SET evaluation = ?, score = ? WHERE id = ?',
        [evaluation.feedback, evaluation.score, this.lastID],
        (err) => {
          if (err) console.error('Error updating evaluation:', err);
        }
      );

      res.json({
        success: true,
        evaluation: evaluation,
        messageId: this.lastID
      });
    });
  } catch (error) {
    console.error('Answer submission error:', error);
    res.status(500).json({ error: 'Error mengevaluasi jawaban' });
  }
});

// Get Chat History
app.get('/api/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  const query = 'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC';
  db.all(query, [sessionId], (err, messages) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil riwayat chat' });
    }
    res.json({ success: true, messages });
  });
});

// End Defense Session
app.post('/api/end-defense', (req, res) => {
  const { sessionId } = req.body;

  // Calculate final score from all evaluations
  db.all(
    'SELECT score FROM chat_messages WHERE session_id = ? AND sender = "mahasiswa" AND score IS NOT NULL',
    [sessionId],
    (err, scores) => {
      if (err) {
        return res.status(500).json({ error: 'Error menghitung nilai' });
      }

      let finalScore = 0;
      if (scores.length > 0) {
        const totalScore = scores.reduce((sum, msg) => sum + msg.score, 0);
        finalScore = totalScore / scores.length;
      }

      db.run(
        'UPDATE defense_sessions SET ended_at = CURRENT_TIMESTAMP, final_score = ?, status = "completed" WHERE id = ?',
        [finalScore, sessionId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error mengakhiri sidang' });
          }

          res.json({
            success: true,
            finalScore: finalScore.toFixed(2),
            message: 'Sidang berhasil diselesaikan'
          });
        }
      );
    }
  );
});

// Text-to-Speech endpoint (using free TTS)
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;

    // Option 1: Return text for browser's Web Speech API
    res.json({
      success: true,
      text: text,
      method: 'browser' // Client will use browser's speech synthesis
    });

    // Option 2: If you want to use external API like ElevenLabs, VoiceRSS, etc.
    // Uncomment and configure below:
    /*
    const response = await axios.post('https://api.voicerss.org/', {
      key: process.env.VOICERSS_API_KEY,
      src: text,
      hl: 'id-id',
      c: 'MP3',
      f: '44khz_16bit_stereo'
    });

    res.json({
      success: true,
      audioUrl: response.data
    });
    */
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'Error generating speech' });
  }
});

// Helper Functions

function generateQuestion(thesisContent, previousMessages = []) {
  // Simple rule-based question generation
  // In production, integrate with OpenAI, Gemini, or other LLM APIs

  const questions = [
    'Selamat pagi, silakan perkenalkan diri Anda dan jelaskan latar belakang penelitian skripsi Anda.',
    'Apa rumusan masalah utama dalam penelitian Anda?',
    'Metode penelitian apa yang Anda gunakan dan mengapa memilih metode tersebut?',
    'Apa kontribusi atau novelty dari penelitian Anda?',
    'Bagaimana hasil penelitian Anda dibandingkan dengan penelitian sebelumnya?',
    'Apa keterbatasan dari penelitian yang Anda lakukan?',
    'Apa saran Anda untuk penelitian selanjutnya?'
  ];

  const questionCount = previousMessages.filter(m => m.sender === 'dosen').length;

  if (questionCount < questions.length) {
    return questions[questionCount];
  } else {
    return 'Terima kasih atas presentasi dan jawaban Anda. Apakah ada yang ingin Anda tambahkan?';
  }
}

async function evaluateAnswer(answer, thesisContent) {
  // Simple evaluation logic
  // In production, use AI for more sophisticated evaluation

  const wordCount = answer.trim().split(/\s+/).length;
  let score = 0;
  let feedback = '';

  if (wordCount < 10) {
    score = 50;
    feedback = 'Jawaban Anda terlalu singkat. Coba berikan penjelasan yang lebih detail dan komprehensif.';
  } else if (wordCount < 30) {
    score = 70;
    feedback = 'Jawaban cukup baik, namun bisa lebih detail. Tambahkan contoh atau penjelasan yang lebih mendalam.';
  } else {
    score = 85;
    feedback = 'Jawaban Anda baik dan cukup komprehensif. Teruskan dengan penjelasan yang jelas seperti ini.';
  }

  // Bonus for relevant keywords (simplified)
  const keywords = ['penelitian', 'metode', 'hasil', 'analisis', 'data', 'teori'];
  const answerLower = answer.toLowerCase();
  const matchedKeywords = keywords.filter(k => answerLower.includes(k));

  score += matchedKeywords.length * 2;
  score = Math.min(score, 100);

  return { score, feedback };
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

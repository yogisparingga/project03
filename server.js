const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const FormData = require('form-data');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

// Import AI SDKs
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize AI clients based on available API keys
let openai = null;
let gemini = null;
let groq = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('✓ OpenAI initialized');
}

if (process.env.GEMINI_API_KEY) {
  gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('✓ Google Gemini initialized');
}

if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('✓ Groq initialized');
}

// Determine which AI provider to use
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'; // openai, gemini, or groq

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'thesis-correction-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    // Check if user exists or create new one
    const email = profile.emails[0].value;
    const name = profile.displayName;

    db.get('SELECT * FROM students WHERE email = ?', [email], (err, user) => {
      if (user) {
        return done(null, user);
      } else {
        // Create new student account
        db.run(
          'INSERT INTO students (nama, email, google_id, status) VALUES (?, ?, ?, ?)',
          [name, email, profile.id, 'active'],
          function(err) {
            if (err) {
              return done(err);
            }
            db.get('SELECT * FROM students WHERE id = ?', [this.lastID], (err, newUser) => {
              return done(null, newUser);
            });
          }
        );
      }
    });
  }));
  console.log('✓ Google OAuth configured');
}

// Database setup
const db = new sqlite3.Database('./thesis_defense.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✓ Database connected');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  // Admin users table
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nama TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default admin if not exists (username: admin, password: admin123)
  db.get('SELECT id FROM admins WHERE username = ?', ['admin'], (err, row) => {
    if (!row) {
      db.run(
        'INSERT INTO admins (username, password, nama) VALUES (?, ?, ?)',
        ['admin', 'admin123', 'Administrator']
      );
      console.log('✓ Default admin created (username: admin, password: admin123)');
    }
  });

  // AI Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize default AI settings
  const defaultSettings = [
    { key: 'system_prompt', value: `Anda adalah Dr. AI Penguji, seorang dosen pembimbing yang berpengalaman dalam sidang skripsi.
Tugas Anda adalah mengajukan pertanyaan yang relevan, kritis, dan konstruktif kepada mahasiswa berdasarkan konten skripsi mereka.

Gaya pertanyaan:
- Profesional namun ramah
- Mendalam dan analitis
- Membantu mahasiswa berpikir kritis
- Fokus pada metodologi, hasil, dan kontribusi penelitian` },
    { key: 'temperature', value: '0.7' },
    { key: 'max_tokens', value: '300' },
    { key: 'ai_name', value: 'Dr. AI Penguji, M.Kom' }
  ];

  defaultSettings.forEach(setting => {
    db.get('SELECT id FROM ai_settings WHERE setting_key = ?', [setting.key], (err, row) => {
      if (!row) {
        db.run(
          'INSERT INTO ai_settings (setting_key, setting_value) VALUES (?, ?)',
          [setting.key, setting.value]
        );
      }
    });
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nim TEXT UNIQUE,
      nama TEXT NOT NULL,
      no_hp TEXT UNIQUE,
      email TEXT UNIQUE,
      google_id TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS thesis_uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      file_path TEXT,
      file_type TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // Table for editable thesis documents
  db.run(`
    CREATE TABLE IF NOT EXISTS thesis_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      original_filename TEXT,
      template_type TEXT,
      last_edited DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  // Table for correction history
  db.run(`
    CREATE TABLE IF NOT EXISTS correction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      correction_type TEXT NOT NULL,
      original_text TEXT NOT NULL,
      corrected_text TEXT NOT NULL,
      suggestion TEXT,
      applied BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES thesis_documents(id)
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
      conversation_history TEXT,
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
    const allowedTypes = /pdf|txt|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'application/pdf' ||
                     file.mimetype === 'text/plain' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, and DOCX files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Audio upload for speech-to-text
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// ============== AI Helper Functions ==============

// Generate question using AI
async function generateAIQuestion(thesisContent, conversationHistory, studentName) {
  try {
    // Get AI settings from database
    const aiSettings = await getAISettings();

    const systemPrompt = `${aiSettings.system_prompt}

Mahasiswa: ${studentName}

Konten Skripsi:
${thesisContent.substring(0, 3000)}

${conversationHistory.length === 0 ?
  'Mulai dengan salam pembuka yang hangat dan ajukan pertanyaan pertama tentang latar belakang penelitian.' :
  'Lanjutkan dengan pertanyaan mendalam berdasarkan jawaban mahasiswa sebelumnya.'}`;

    let question = '';

    const temperature = parseFloat(aiSettings.temperature) || 0.7;
    const maxTokens = parseInt(aiSettings.max_tokens) || 300;

    if (AI_PROVIDER === 'openai' && openai) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ];

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      });

      question = completion.choices[0].message.content;

    } else if (AI_PROVIDER === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = systemPrompt + '\n\n' +
        conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');

      const result = await model.generateContent(prompt);
      question = result.response.text();

    } else if (AI_PROVIDER === 'groq' && groq) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ];

      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      });

      question = completion.choices[0].message.content;

    } else {
      // Fallback to simple questions if no AI provider
      question = getFallbackQuestion(conversationHistory.length / 2);
    }

    return question;

  } catch (error) {
    console.error('AI Question Generation Error:', error);
    return getFallbackQuestion(conversationHistory.length / 2);
  }
}

// Evaluate answer using AI
async function evaluateAIAnswer(answer, thesisContent, question) {
  try {
    const systemPrompt = `Anda adalah penguji sidang skripsi yang adil dan konstruktif.
Berikan evaluasi terhadap jawaban mahasiswa dengan format:

1. Penilaian (0-100)
2. Feedback konstruktif
3. Saran perbaikan (jika ada)

Kriteria penilaian:
- Relevansi dengan pertanyaan (30%)
- Kedalaman pemahaman (30%)
- Kelengkapan jawaban (20%)
- Komunikasi yang jelas (20%)

Pertanyaan: ${question}
Jawaban Mahasiswa: ${answer}
Konteks Skripsi: ${thesisContent.substring(0, 1000)}

Berikan respons dalam format JSON:
{
  "score": [nilai 0-100],
  "feedback": "[feedback detail dalam bahasa Indonesia]",
  "strengths": "[kekuatan jawaban]",
  "improvements": "[saran perbaikan]"
}`;

    let evaluation = null;

    if (AI_PROVIDER === 'openai' && openai) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.5,
        response_format: { type: "json_object" }
      });

      evaluation = JSON.parse(completion.choices[0].message.content);

    } else if (AI_PROVIDER === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(systemPrompt);
      const text = result.response.text();

      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      }

    } else if (AI_PROVIDER === 'groq' && groq) {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.5
      });

      const text = completion.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      }
    }

    // Validate evaluation structure
    if (!evaluation || typeof evaluation.score !== 'number') {
      evaluation = getFallbackEvaluation(answer);
    }

    // Ensure score is within range
    evaluation.score = Math.max(0, Math.min(100, evaluation.score));

    return {
      score: evaluation.score,
      feedback: evaluation.feedback || 'Jawaban Anda telah diterima.',
      strengths: evaluation.strengths || '',
      improvements: evaluation.improvements || ''
    };

  } catch (error) {
    console.error('AI Evaluation Error:', error);
    return getFallbackEvaluation(answer);
  }
}

// Fallback functions when AI is not available
function getFallbackQuestion(questionNumber) {
  const questions = [
    'Selamat pagi. Silakan perkenalkan diri Anda dan jelaskan secara singkat latar belakang penelitian skripsi Anda.',
    'Apa rumusan masalah utama yang Anda identifikasi dalam penelitian ini?',
    'Metode penelitian apa yang Anda gunakan dan mengapa Anda memilih metode tersebut?',
    'Jelaskan kontribusi atau novelty dari penelitian Anda dibandingkan penelitian sebelumnya.',
    'Bagaimana hasil penelitian Anda? Apakah sesuai dengan hipotesis awal?',
    'Apa keterbatasan dari penelitian yang Anda lakukan dan bagaimana dampaknya terhadap hasil?',
    'Apa saran Anda untuk penelitian selanjutnya yang dapat melanjutkan atau menyempurnakan penelitian ini?',
    'Terima kasih atas presentasi dan jawaban Anda. Apakah ada yang ingin Anda tambahkan?'
  ];

  return questions[Math.min(questionNumber, questions.length - 1)];
}

function getFallbackEvaluation(answer) {
  const wordCount = answer.trim().split(/\s+/).length;
  let score = 50;
  let feedback = '';

  if (wordCount < 10) {
    score = 55;
    feedback = 'Jawaban Anda terlalu singkat. Coba berikan penjelasan yang lebih detail dan komprehensif dengan contoh konkret.';
  } else if (wordCount < 30) {
    score = 72;
    feedback = 'Jawaban cukup baik, namun bisa lebih detail. Tambahkan contoh atau penjelasan yang lebih mendalam untuk memperkuat argumen Anda.';
  } else if (wordCount < 50) {
    score = 82;
    feedback = 'Jawaban Anda baik dan cukup komprehensif. Penjelasan sudah jelas, teruskan dengan gaya komunikasi seperti ini.';
  } else {
    score = 88;
    feedback = 'Jawaban sangat baik dan detail. Anda menunjukkan pemahaman yang mendalam terhadap topik penelitian.';
  }

  // Bonus for relevant keywords
  const keywords = ['penelitian', 'metode', 'hasil', 'analisis', 'data', 'teori', 'implementasi', 'evaluasi'];
  const answerLower = answer.toLowerCase();
  const matchedKeywords = keywords.filter(k => answerLower.includes(k));
  score += matchedKeywords.length * 1.5;
  score = Math.min(score, 100);

  return {
    score: Math.round(score),
    feedback: feedback,
    strengths: 'Komunikasi yang baik',
    improvements: wordCount < 30 ? 'Tambahkan lebih banyak detail dan contoh' : ''
  };
}

// ============== API Routes ==============

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
    let fileType = path.extname(file.originalname).toLowerCase().replace('.', '');

    // Extract text from file
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      content = pdfData.text;
    } else if (file.mimetype === 'text/plain') {
      content = fs.readFileSync(file.path, 'utf8');
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const dataBuffer = fs.readFileSync(file.path);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      content = result.value;
    }

    const query = 'INSERT INTO thesis_uploads (student_id, filename, content, file_type, file_path) VALUES (?, ?, ?, ?, ?)';
    db.run(query, [studentId, file.originalname, content, fileType, file.path], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error saat menyimpan file' });
      }

      res.json({
        success: true,
        message: 'File berhasil diupload',
        thesisId: this.lastID,
        fileType: fileType
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

  const query = 'INSERT INTO defense_sessions (student_id, thesis_id, conversation_history) VALUES (?, ?, ?)';
  db.run(query, [studentId, thesisId, JSON.stringify([])], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error memulai sidang' });
    }

    const sessionId = this.lastID;

    // Get thesis content and student info
    db.get('SELECT content FROM thesis_uploads WHERE id = ?', [thesisId], (err, thesis) => {
      if (err || !thesis) {
        return res.status(500).json({ error: 'Error mengambil data skripsi' });
      }

      db.get('SELECT nama FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err || !student) {
          return res.status(500).json({ error: 'Error mengambil data mahasiswa' });
        }

        res.json({
          success: true,
          sessionId: sessionId,
          studentName: student.nama,
          thesisContent: thesis.content
        });
      });
    });
  });
});

// Generate AI Question
app.post('/api/generate-question', async (req, res) => {
  try {
    const { sessionId, thesisContent, studentName } = req.body;

    // Get conversation history
    db.get('SELECT conversation_history FROM defense_sessions WHERE id = ?', [sessionId], async (err, session) => {
      if (err || !session) {
        return res.status(500).json({ error: 'Session tidak ditemukan' });
      }

      let conversationHistory = [];
      try {
        conversationHistory = JSON.parse(session.conversation_history || '[]');
      } catch (e) {
        conversationHistory = [];
      }

      // Generate question using AI
      const question = await generateAIQuestion(thesisContent, conversationHistory, studentName);

      // Save AI message
      const query = 'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)';
      db.run(query, [sessionId, 'dosen', question], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error menyimpan pertanyaan' });
        }

        // Update conversation history
        conversationHistory.push({ role: 'assistant', content: question });
        db.run(
          'UPDATE defense_sessions SET conversation_history = ? WHERE id = ?',
          [JSON.stringify(conversationHistory), sessionId]
        );

        res.json({
          success: true,
          question: question,
          messageId: this.lastID
        });
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

    // Get last question
    db.all(
      'SELECT message FROM chat_messages WHERE session_id = ? AND sender = "dosen" ORDER BY created_at DESC LIMIT 1',
      [sessionId],
      async (err, messages) => {
        if (err) {
          return res.status(500).json({ error: 'Error mengambil pertanyaan' });
        }

        const lastQuestion = messages[0]?.message || '';

        // Save student answer
        const query = 'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)';
        db.run(query, [sessionId, 'mahasiswa', answer], async function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error menyimpan jawaban' });
          }

          const messageId = this.lastID;

          // Evaluate answer using AI
          const evaluation = await evaluateAIAnswer(answer, thesisContent, lastQuestion);

          // Update message with evaluation
          db.run(
            'UPDATE chat_messages SET evaluation = ?, score = ? WHERE id = ?',
            [JSON.stringify(evaluation), evaluation.score, messageId]
          );

          // Update conversation history
          db.get('SELECT conversation_history FROM defense_sessions WHERE id = ?', [sessionId], (err, session) => {
            if (!err && session) {
              let conversationHistory = [];
              try {
                conversationHistory = JSON.parse(session.conversation_history || '[]');
              } catch (e) {
                conversationHistory = [];
              }

              conversationHistory.push({ role: 'user', content: answer });

              db.run(
                'UPDATE defense_sessions SET conversation_history = ? WHERE id = ?',
                [JSON.stringify(conversationHistory), sessionId]
              );
            }
          });

          res.json({
            success: true,
            evaluation: evaluation,
            messageId: messageId
          });
        });
      }
    );
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

    // Parse evaluation JSON if exists
    messages = messages.map(msg => {
      if (msg.evaluation) {
        try {
          msg.evaluation = JSON.parse(msg.evaluation);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      return msg;
    });

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

// Text-to-Speech using OpenAI TTS
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (openai && process.env.USE_OPENAI_TTS === 'true') {
      // Use OpenAI TTS
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length
      });
      res.send(buffer);

    } else {
      // Fallback: return text for client-side TTS
      res.json({
        success: true,
        text: text,
        method: 'client'
      });
    }
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).json({ error: 'Error generating speech' });
  }
});

// Speech-to-Text using OpenAI Whisper
app.post('/api/stt', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    if (openai) {
      // Save audio buffer to temporary file
      const tempFilePath = path.join(__dirname, 'uploads', `temp-${Date.now()}.webm`);
      fs.writeFileSync(tempFilePath, req.file.buffer);

      // Use OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "id"
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      res.json({
        success: true,
        text: transcription.text
      });

    } else {
      res.status(503).json({
        error: 'Speech-to-text service not available. Please configure OpenAI API key.'
      });
    }
  } catch (error) {
    console.error('STT error:', error);
    res.status(500).json({ error: 'Error transcribing audio' });
  }
});

// Get AI Provider Info
app.get('/api/ai-info', (req, res) => {
  res.json({
    provider: AI_PROVIDER,
    available: {
      openai: !!openai,
      gemini: !!gemini,
      groq: !!groq
    },
    features: {
      tts: !!openai && process.env.USE_OPENAI_TTS === 'true',
      stt: !!openai
    }
  });
});

// ============== ADMIN API ROUTES ==============

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password harus diisi' });
  }

  const query = 'SELECT * FROM admins WHERE username = ? AND password = ?';
  db.get(query, [username, password], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: 'Error saat login' });
    }
    if (!admin) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        nama: admin.nama
      }
    });
  });
});

// Get Dashboard Statistics
app.get('/api/admin/stats', (req, res) => {
  const stats = {};

  db.get('SELECT COUNT(*) as count FROM students', (err, result) => {
    stats.totalStudents = result ? result.count : 0;

    db.get('SELECT COUNT(*) as count FROM thesis_uploads', (err, result) => {
      stats.totalThesis = result ? result.count : 0;

      db.get('SELECT COUNT(*) as count FROM defense_sessions', (err, result) => {
        stats.totalSessions = result ? result.count : 0;

        db.get('SELECT COUNT(*) as count FROM defense_sessions WHERE status = "completed"', (err, result) => {
          stats.completedSessions = result ? result.count : 0;

          db.get('SELECT AVG(final_score) as avg FROM defense_sessions WHERE status = "completed"', (err, result) => {
            stats.averageScore = result && result.avg ? result.avg.toFixed(2) : 0;

            res.json({ success: true, stats });
          });
        });
      });
    });
  });
});

// Get All Students
app.get('/api/admin/students', (req, res) => {
  const query = `
    SELECT
      s.*,
      COUNT(DISTINCT t.id) as thesis_count,
      COUNT(DISTINCT ds.id) as session_count
    FROM students s
    LEFT JOIN thesis_uploads t ON s.id = t.student_id
    LEFT JOIN defense_sessions ds ON s.id = ds.student_id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `;

  db.all(query, (err, students) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil data mahasiswa' });
    }
    res.json({ success: true, students });
  });
});

// Update Student Status
app.put('/api/admin/students/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run(
    'UPDATE students SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error mengupdate status' });
      }
      res.json({ success: true, message: 'Status berhasil diupdate' });
    }
  );
});

// Delete Student
app.delete('/api/admin/students/:id', (req, res) => {
  const { id } = req.params;

  // Delete related data first
  db.run('DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM defense_sessions WHERE student_id = ?)', [id]);
  db.run('DELETE FROM defense_sessions WHERE student_id = ?', [id]);
  db.run('DELETE FROM thesis_uploads WHERE student_id = ?', [id]);
  db.run('DELETE FROM students WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error menghapus mahasiswa' });
    }
    res.json({ success: true, message: 'Mahasiswa berhasil dihapus' });
  });
});

// Get All Thesis Files
app.get('/api/admin/thesis', (req, res) => {
  const query = `
    SELECT
      t.*,
      s.nim,
      s.nama as student_name,
      COUNT(DISTINCT ds.id) as session_count
    FROM thesis_uploads t
    JOIN students s ON t.student_id = s.id
    LEFT JOIN defense_sessions ds ON t.id = ds.thesis_id
    GROUP BY t.id
    ORDER BY t.uploaded_at DESC
  `;

  db.all(query, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil data file' });
    }
    res.json({ success: true, files });
  });
});

// Delete Thesis File
app.delete('/api/admin/thesis/:id', (req, res) => {
  const { id } = req.params;

  // Get file info first
  db.get('SELECT * FROM thesis_uploads WHERE id = ?', [id], (err, file) => {
    if (err || !file) {
      return res.status(500).json({ error: 'File tidak ditemukan' });
    }

    // Delete from database
    db.run('DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM defense_sessions WHERE thesis_id = ?)', [id]);
    db.run('DELETE FROM defense_sessions WHERE thesis_id = ?', [id]);
    db.run('DELETE FROM thesis_uploads WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error menghapus file' });
      }
      res.json({ success: true, message: 'File berhasil dihapus' });
    });
  });
});

// Get All Defense Sessions
app.get('/api/admin/sessions', (req, res) => {
  const query = `
    SELECT
      ds.*,
      s.nim,
      s.nama as student_name,
      t.filename as thesis_filename,
      COUNT(cm.id) as message_count
    FROM defense_sessions ds
    JOIN students s ON ds.student_id = s.id
    JOIN thesis_uploads t ON ds.thesis_id = t.id
    LEFT JOIN chat_messages cm ON ds.id = cm.session_id
    GROUP BY ds.id
    ORDER BY ds.started_at DESC
  `;

  db.all(query, (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil data sesi' });
    }
    res.json({ success: true, sessions });
  });
});

// Get Session Detail
app.get('/api/admin/sessions/:id', (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT
      ds.*,
      s.nim,
      s.nama as student_name,
      s.no_hp,
      t.filename as thesis_filename
    FROM defense_sessions ds
    JOIN students s ON ds.student_id = s.id
    JOIN thesis_uploads t ON ds.thesis_id = t.id
    WHERE ds.id = ?
  `, [id], (err, session) => {
    if (err || !session) {
      return res.status(500).json({ error: 'Sesi tidak ditemukan' });
    }

    // Get chat messages
    db.all(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      [id],
      (err, messages) => {
        if (err) {
          return res.status(500).json({ error: 'Error mengambil pesan' });
        }

        session.messages = messages;
        res.json({ success: true, session });
      }
    );
  });
});

// Get AI Settings
app.get('/api/admin/ai-settings', (req, res) => {
  db.all('SELECT * FROM ai_settings', (err, settings) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil pengaturan AI' });
    }

    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });

    res.json({ success: true, settings: settingsObj });
  });
});

// Update AI Settings
app.put('/api/admin/ai-settings', (req, res) => {
  const { system_prompt, temperature, max_tokens, ai_name } = req.body;

  const updates = [
    { key: 'system_prompt', value: system_prompt },
    { key: 'temperature', value: temperature },
    { key: 'max_tokens', value: max_tokens },
    { key: 'ai_name', value: ai_name }
  ];

  let completed = 0;
  updates.forEach(update => {
    db.run(
      'UPDATE ai_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
      [update.value, update.key],
      (err) => {
        completed++;
        if (completed === updates.length) {
          res.json({ success: true, message: 'Pengaturan AI berhasil diupdate' });
        }
      }
    );
  });
});

// Helper function to get AI settings from database
async function getAISettings() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ai_settings', (err, settings) => {
      if (err) {
        reject(err);
      } else {
        const settingsObj = {};
        settings.forEach(s => {
          settingsObj[s.setting_key] = s.setting_value;
        });
        resolve(settingsObj);
      }
    });
  });
}

// ============== GOOGLE OAUTH ROUTES ==============

// Initiate Google OAuth
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/?student=' + JSON.stringify(req.user));
  }
);

// Logout
app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// ============== AI CORRECTION ENDPOINTS ==============

// AI Typo and Grammar Correction
app.post('/api/correct/typo-grammar', async (req, res) => {
  try {
    const { text, documentId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text harus diisi' });
    }

    const systemPrompt = `Anda adalah asisten AI yang ahli dalam mengoreksi kesalahan penulisan bahasa Indonesia.
Analisis teks berikut dan perbaiki:
1. Kesalahan ejaan (typo)
2. Tata bahasa yang salah
3. Penggunaan tanda baca yang tidak tepat
4. Kesalahan penulisan kata

Berikan respons dalam format JSON:
{
  "corrected_text": "teks yang sudah diperbaiki",
  "corrections": [
    {
      "type": "typo|grammar|punctuation",
      "original": "teks asli yang salah",
      "corrected": "teks yang diperbaiki",
      "explanation": "penjelasan singkat"
    }
  ],
  "summary": "ringkasan perbaikan yang dilakukan"
}

Teks yang akan dikoreksi:
${text}`;

    let result = null;

    if (AI_PROVIDER === 'openai' && openai) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      result = JSON.parse(completion.choices[0].message.content);

    } else if (AI_PROVIDER === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const response = await model.generateContent(systemPrompt);
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }

    } else if (AI_PROVIDER === 'groq' && groq) {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.3
      });
      const text = completion.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }

    if (!result) {
      return res.status(500).json({ error: 'AI service tidak tersedia' });
    }

    // Save corrections to history if documentId provided
    if (documentId && result.corrections) {
      for (const correction of result.corrections) {
        db.run(
          'INSERT INTO correction_history (document_id, correction_type, original_text, corrected_text, suggestion) VALUES (?, ?, ?, ?, ?)',
          [documentId, correction.type, correction.original, correction.corrected, correction.explanation]
        );
      }
    }

    res.json({ success: true, result });

  } catch (error) {
    console.error('Typo/Grammar correction error:', error);
    res.status(500).json({ error: 'Error saat mengoreksi teks' });
  }
});

// AI Paraphrase
app.post('/api/correct/paraphrase', async (req, res) => {
  try {
    const { text, documentId, style } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text harus diisi' });
    }

    const styleGuide = style || 'formal akademis';

    const systemPrompt = `Anda adalah asisten AI yang ahli dalam parafrase teks bahasa Indonesia.
Parafrasekan teks berikut dengan gaya ${styleGuide}, sambil mempertahankan makna aslinya.

Berikan respons dalam format JSON:
{
  "paraphrased_text": "teks hasil parafrase",
  "improvements": ["perbaikan 1", "perbaikan 2"],
  "readability_score": "nilai keterbacaan (1-10)"
}

Teks yang akan diparafrase:
${text}`;

    let result = null;

    if (AI_PROVIDER === 'openai' && openai) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      result = JSON.parse(completion.choices[0].message.content);

    } else if (AI_PROVIDER === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const response = await model.generateContent(systemPrompt);
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }

    } else if (AI_PROVIDER === 'groq' && groq) {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.7
      });
      const text = completion.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }

    if (!result) {
      return res.status(500).json({ error: 'AI service tidak tersedia' });
    }

    // Save to correction history
    if (documentId) {
      db.run(
        'INSERT INTO correction_history (document_id, correction_type, original_text, corrected_text, suggestion) VALUES (?, ?, ?, ?, ?)',
        [documentId, 'paraphrase', text, result.paraphrased_text, JSON.stringify(result.improvements)]
      );
    }

    res.json({ success: true, result });

  } catch (error) {
    console.error('Paraphrase error:', error);
    res.status(500).json({ error: 'Error saat memparafrase teks' });
  }
});

// AI Citation Correction
app.post('/api/correct/citation', async (req, res) => {
  try {
    const { text, documentId, citationStyle } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text harus diisi' });
    }

    const style = citationStyle || 'APA';

    const systemPrompt = `Anda adalah asisten AI yang ahli dalam penulisan sitasi akademis.
Analisis teks berikut dan perbaiki sitasi sesuai format ${style}.

Berikan respons dalam format JSON:
{
  "corrected_text": "teks dengan sitasi yang diperbaiki",
  "citations_found": [
    {
      "original": "sitasi asli",
      "corrected": "sitasi yang diperbaiki",
      "issues": ["masalah yang ditemukan"]
    }
  ],
  "missing_citations": ["bagian yang perlu sitasi"],
  "suggestions": ["saran perbaikan"]
}

Teks yang akan diperiksa:
${text}`;

    let result = null;

    if (AI_PROVIDER === 'openai' && openai) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      result = JSON.parse(completion.choices[0].message.content);

    } else if (AI_PROVIDER === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const response = await model.generateContent(systemPrompt);
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }

    } else if (AI_PROVIDER === 'groq' && groq) {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.3
      });
      const text = completion.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }

    if (!result) {
      return res.status(500).json({ error: 'AI service tidak tersedia' });
    }

    // Save to correction history
    if (documentId && result.citations_found) {
      for (const citation of result.citations_found) {
        db.run(
          'INSERT INTO correction_history (document_id, correction_type, original_text, corrected_text, suggestion) VALUES (?, ?, ?, ?, ?)',
          [documentId, 'citation', citation.original, citation.corrected, JSON.stringify(citation.issues)]
        );
      }
    }

    res.json({ success: true, result });

  } catch (error) {
    console.error('Citation correction error:', error);
    res.status(500).json({ error: 'Error saat mengoreksi sitasi' });
  }
});

// AI Format Thesis
app.post('/api/correct/format', async (req, res) => {
  try {
    const { text, documentId, template } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text harus diisi' });
    }

    const templateType = template || 'standard';

    const systemPrompt = `Anda adalah asisten AI yang ahli dalam memformat dokumen skripsi.
Format teks berikut sesuai template skripsi ${templateType} dengan struktur:
1. Judul (centered, bold, uppercase)
2. Bab dan Sub-bab (numbered, bold)
3. Paragraf (justified, indented)
4. Spacing yang tepat

Berikan respons dalam format JSON:
{
  "formatted_text": "teks yang sudah diformat",
  "structure": {
    "chapters": ["daftar bab"],
    "sections": ["daftar sub-bab"]
  },
  "formatting_applied": ["daftar format yang diterapkan"]
}

Teks yang akan diformat:
${text}`;

    let result = null;

    if (AI_PROVIDER === 'openai' && openai) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      result = JSON.parse(completion.choices[0].message.content);

    } else if (AI_PROVIDER === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const response = await model.generateContent(systemPrompt);
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }

    } else if (AI_PROVIDER === 'groq' && groq) {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.3
      });
      const text = completion.choices[0].message.content;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    }

    if (!result) {
      return res.status(500).json({ error: 'AI service tidak tersedia' });
    }

    // Save to correction history
    if (documentId) {
      db.run(
        'INSERT INTO correction_history (document_id, correction_type, original_text, corrected_text, suggestion) VALUES (?, ?, ?, ?, ?)',
        [documentId, 'format', text.substring(0, 500), result.formatted_text.substring(0, 500), JSON.stringify(result.formatting_applied)]
      );
    }

    res.json({ success: true, result });

  } catch (error) {
    console.error('Format error:', error);
    res.status(500).json({ error: 'Error saat memformat teks' });
  }
});

// ============== DOCUMENT MANAGEMENT ENDPOINTS ==============

// Create new document from uploaded file
app.post('/api/documents/create', async (req, res) => {
  try {
    const { studentId, thesisId, title } = req.body;

    if (thesisId) {
      // Create from uploaded thesis
      db.get('SELECT content, filename FROM thesis_uploads WHERE id = ?', [thesisId], (err, thesis) => {
        if (err || !thesis) {
          return res.status(404).json({ error: 'File skripsi tidak ditemukan' });
        }

        const query = 'INSERT INTO thesis_documents (student_id, title, content, original_filename) VALUES (?, ?, ?, ?)';
        db.run(query, [studentId, title || thesis.filename, thesis.content, thesis.filename], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error membuat dokumen' });
          }

          res.json({
            success: true,
            documentId: this.lastID,
            message: 'Dokumen berhasil dibuat'
          });
        });
      });
    } else if (title) {
      // Create empty document
      const query = 'INSERT INTO thesis_documents (student_id, title, content) VALUES (?, ?, ?)';
      db.run(query, [studentId, title, '<p><br></p>'], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error membuat dokumen' });
        }

        res.json({
          success: true,
          documentId: this.lastID,
          message: 'Dokumen kosong berhasil dibuat'
        });
      });
    } else {
      return res.status(400).json({ error: 'Harus menyediakan thesisId atau title' });
    }
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Error membuat dokumen' });
  }
});

// Get all documents for a student
app.get('/api/documents/:studentId', (req, res) => {
  const { studentId } = req.params;

  const query = 'SELECT id, title, original_filename, template_type, last_edited, created_at FROM thesis_documents WHERE student_id = ? ORDER BY last_edited DESC';
  db.all(query, [studentId], (err, documents) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil dokumen' });
    }
    res.json({ success: true, documents });
  });
});

// Get document content
app.get('/api/documents/content/:documentId', (req, res) => {
  const { documentId } = req.params;

  const query = 'SELECT * FROM thesis_documents WHERE id = ?';
  db.get(query, [documentId], (err, document) => {
    if (err || !document) {
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }
    res.json({ success: true, document });
  });
});

// Update document content
app.put('/api/documents/:documentId', (req, res) => {
  const { documentId } = req.params;
  const { content, title } = req.body;

  let query = 'UPDATE thesis_documents SET content = ?, last_edited = CURRENT_TIMESTAMP';
  const params = [content];

  if (title) {
    query += ', title = ?';
    params.push(title);
  }

  query += ' WHERE id = ?';
  params.push(documentId);

  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error mengupdate dokumen' });
    }
    res.json({ success: true, message: 'Dokumen berhasil diupdate' });
  });
});

// Delete document
app.delete('/api/documents/:documentId', (req, res) => {
  const { documentId } = req.params;

  // Delete correction history first
  db.run('DELETE FROM correction_history WHERE document_id = ?', [documentId]);
  db.run('DELETE FROM thesis_documents WHERE id = ?', [documentId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error menghapus dokumen' });
    }
    res.json({ success: true, message: 'Dokumen berhasil dihapus' });
  });
});

// Get correction history for a document
app.get('/api/corrections/:documentId', (req, res) => {
  const { documentId } = req.params;

  const query = 'SELECT * FROM correction_history WHERE document_id = ? ORDER BY created_at DESC LIMIT 100';
  db.all(query, [documentId], (err, corrections) => {
    if (err) {
      return res.status(500).json({ error: 'Error mengambil riwayat koreksi' });
    }
    res.json({ success: true, corrections });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 AI Provider: ${AI_PROVIDER}`);
  console.log(`🎤 TTS Available: ${openai && process.env.USE_OPENAI_TTS === 'true' ? 'Yes (OpenAI)' : 'No (Client-side)'}`);
  console.log(`🎙️  STT Available: ${openai ? 'Yes (Whisper)' : 'No'}\n`);
});

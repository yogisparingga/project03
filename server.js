const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const FormData = require('form-data');
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
    const allowedTypes = /pdf|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && (mimetype || file.mimetype === 'text/plain')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are allowed'));
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
    const systemPrompt = `Anda adalah Dr. AI Penguji, seorang dosen pembimbing yang berpengalaman dalam sidang skripsi.
Tugas Anda adalah mengajukan pertanyaan yang relevan, kritis, dan konstruktif kepada mahasiswa berdasarkan konten skripsi mereka.

Gaya pertanyaan:
- Profesional namun ramah
- Mendalam dan analitis
- Membantu mahasiswa berpikir kritis
- Fokus pada metodologi, hasil, dan kontribusi penelitian

Mahasiswa: ${studentName}

Konten Skripsi:
${thesisContent.substring(0, 3000)}

${conversationHistory.length === 0 ?
  'Mulai dengan salam pembuka yang hangat dan ajukan pertanyaan pertama tentang latar belakang penelitian.' :
  'Lanjutkan dengan pertanyaan mendalam berdasarkan jawaban mahasiswa sebelumnya.'}`;

    let question = '';

    if (AI_PROVIDER === 'openai' && openai) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ];

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
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
        temperature: 0.7,
        max_tokens: 300
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

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 AI Provider: ${AI_PROVIDER}`);
  console.log(`🎤 TTS Available: ${openai && process.env.USE_OPENAI_TTS === 'true' ? 'Yes (OpenAI)' : 'No (Client-side)'}`);
  console.log(`🎙️  STT Available: ${openai ? 'Yes (Whisper)' : 'No'}\n`);
});

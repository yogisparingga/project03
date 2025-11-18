# 🎓 Simulasi Sidang Skripsi - AI Powered

Aplikasi web untuk simulasi sidang skripsi dengan dosen penguji AI yang dapat memberikan pertanyaan dan evaluasi secara real-time menggunakan Large Language Models (LLM).

## ✨ Fitur Utama

- **Registrasi Mahasiswa**: Sistem registrasi dengan validasi NIM dan nomor HP yang unik
- **Upload Skripsi**: Upload file skripsi dalam format PDF atau TXT
- **Dosen AI Penguji**: AI yang dapat mengajukan pertanyaan kontekstual berdasarkan konten skripsi
- **LLM Integration**: Mendukung OpenAI GPT, Google Gemini, dan Groq
- **Text-to-Speech (TTS)**: Dosen AI berbicara menggunakan OpenAI TTS atau browser synthesis
- **Speech-to-Text (STT)**: Mahasiswa dapat menjawab dengan suara menggunakan OpenAI Whisper
- **Evaluasi AI**: Sistem penilaian cerdas menggunakan AI untuk setiap jawaban
- **Chat Interface**: Antarmuka chat yang interaktif dan user-friendly
- **Scoring System**: Penilaian akhir berdasarkan performa selama sidang

## 🚀 Teknologi yang Digunakan

### Backend
- Node.js + Express.js
- SQLite3 (Database)
- Multer (File upload)
- PDF-Parse (Ekstraksi teks dari PDF)
- **OpenAI API** (GPT-4o-mini, Whisper, TTS)
- **Google Gemini API** (Alternative LLM)
- **Groq API** (Fast inference, FREE)

### Frontend
- HTML5 + CSS3
- JavaScript (Vanilla)
- MediaRecorder API (Audio recording)
- Fetch API (HTTP requests)

## 🤖 AI Provider Options

Aplikasi ini mendukung 3 provider AI:

### 1. OpenAI (Recommended)
- **Model**: GPT-4o-mini, GPT-4, GPT-3.5
- **TTS**: OpenAI TTS (natural voice)
- **STT**: Whisper (best quality)
- **Cost**: Paid (affordable)
- **Best for**: Highest quality responses

### 2. Google Gemini
- **Model**: Gemini Pro
- **TTS**: Browser fallback
- **STT**: Not supported
- **Cost**: FREE tier available
- **Best for**: Free alternative with good quality

### 3. Groq
- **Model**: Mixtral-8x7b, Llama, Gemma
- **TTS**: Browser fallback
- **STT**: Not supported
- **Cost**: FREE with generous limits
- **Best for**: Fast inference, free usage

## 📋 Prasyarat

- Node.js (v14 atau lebih baru)
- npm atau yarn
- API Key dari salah satu provider AI (OpenAI/Gemini/Groq)
- Browser modern (Chrome, Edge, Safari)

## 🔧 Instalasi

### 1. Clone dan Install Dependencies

```bash
git clone <repository-url>
cd project03
npm install
```

### 2. Setup API Keys

Buat file `.env` dari template:

```bash
cp .env.example .env
```

Edit file `.env` dan pilih salah satu provider:

#### Option A: OpenAI (Best Quality)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
USE_OPENAI_TTS=true
```

Dapatkan API key di: https://platform.openai.com/api-keys

#### Option B: Google Gemini (FREE)

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
```

Dapatkan API key di: https://makersuite.google.com/app/apikey

#### Option C: Groq (FREE, Fast)

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=mixtral-8x7b-32768
```

Dapatkan API key di: https://console.groq.com/keys

### 3. Jalankan Aplikasi

```bash
npm start
```

Atau untuk development mode:

```bash
npm run dev
```

### 4. Akses Aplikasi

Buka browser dan kunjungi:
```
http://localhost:3000
```

## 📖 Cara Penggunaan

### 1. Registrasi
1. Klik tab "Daftar"
2. Isi formulir:
   - NIM (harus unik)
   - Nama Lengkap
   - Nomor HP (harus unik)
3. Klik "Daftar"

### 2. Login
1. Masukkan NIM yang telah didaftarkan
2. Klik "Masuk"

### 3. Upload Skripsi
1. Di dashboard, klik area upload
2. Pilih file skripsi (PDF atau TXT)
3. Klik "Upload Skripsi"
4. Tunggu hingga proses selesai

**Tip**: Gunakan file `sample-thesis.txt` yang sudah disediakan untuk testing

### 4. Mulai Sidang Virtual
1. Klik tombol "Mulai Sidang" pada skripsi yang sudah diupload
2. AI Dosen akan menyambut dan mengajukan pertanyaan pertama
3. Dengarkan pertanyaan (AI akan berbicara)

### 5. Menjawab Pertanyaan

**Cara 1 - Ketik:**
- Ketik jawaban di text area
- Klik "Kirim"

**Cara 2 - Suara (jika OpenAI API tersedia):**
- Klik tombol 🎤
- Berbicara dengan jelas
- Klik ⏹️ untuk selesai
- Jawaban akan muncul di text area
- Klik "Kirim"

### 6. Terima Evaluasi
- AI akan mengevaluasi jawaban Anda
- Feedback detail akan muncul di chat
- Skor akan ditampilkan
- AI akan mengucapkan feedback

### 7. Lanjutkan Sidang
- AI akan mengajukan pertanyaan berikutnya
- Ulangi proses menjawab
- Biasanya 5-7 pertanyaan per sidang

### 8. Akhiri Sidang
- Klik tombol "Akhiri Sidang"
- Lihat nilai akhir dan grade
- Review ringkasan sidang

## 🎤 Fitur TTS & STT

### Text-to-Speech (TTS)

**Dengan OpenAI API:**
- Suara natural dan berkualitas tinggi
- Voice: Alloy (default)
- Model: tts-1
- Bahasa: Indonesia

**Fallback Browser:**
- Jika OpenAI tidak tersedia
- Menggunakan Web Speech API
- Gratis, tidak perlu API key

### Speech-to-Text (STT)

**Dengan OpenAI Whisper:**
- Akurasi tinggi untuk bahasa Indonesia
- Model: whisper-1
- Support berbagai format audio

**Browser Speech Recognition:**
- Fallback otomatis jika Whisper tidak tersedia
- Hanya di Chrome/Edge
- Gratis

## 🎯 Sistem Penilaian AI

AI mengevaluasi jawaban berdasarkan:

1. **Relevansi (30%)**: Seberapa relevan jawaban dengan pertanyaan
2. **Kedalaman (30%)**: Pemahaman mendalam terhadap topik
3. **Kelengkapan (20%)**: Kelengkapan jawaban
4. **Komunikasi (20%)**: Kejelasan penyampaian

**Skala Nilai**:
- **A (85-100)**: Sangat Baik - Pemahaman sempurna
- **B (75-84)**: Baik - Pemahaman yang solid
- **C (65-74)**: Cukup - Perlu perbaikan
- **D (<65)**: Perlu Banyak Perbaikan

## 📊 Contoh Pertanyaan AI

AI akan mengajukan pertanyaan seperti:

1. "Jelaskan latar belakang dan motivasi penelitian Anda"
2. "Apa rumusan masalah utama dalam penelitian ini?"
3. "Mengapa Anda memilih metode penelitian tersebut?"
4. "Jelaskan kontribusi atau novelty dari penelitian Anda"
5. "Bagaimana hasil penelitian dibandingkan penelitian sebelumnya?"
6. "Apa keterbatasan penelitian dan dampaknya?"
7. "Apa saran untuk penelitian selanjutnya?"

## 🔄 Alur Kerja Aplikasi

```
┌─────────────┐
│  Register   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Login    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Upload    │
│   Thesis    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Start    │
│   Defense   │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│ AI Asks     │◄────►│   Student    │
│ Question    │      │   Answers    │
│ (LLM API)   │      │  (Type/Mic)  │
└──────┬──────┘      └──────────────┘
       │
       │ (AI Evaluates)
       │
       ▼
┌─────────────┐
│ Show Score  │
│ & Feedback  │
└──────┬──────┘
       │
       │ (Repeat 5-7x)
       │
       ▼
┌─────────────┐
│     End     │
│   Defense   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Results   │
│  & Grading  │
└─────────────┘
```

## 💰 Estimasi Biaya (OpenAI)

Untuk 1 sesi sidang lengkap (~7 pertanyaan):

- **GPT-4o-mini**: ~$0.02 - $0.05
- **Whisper STT**: ~$0.01 - $0.02
- **TTS**: ~$0.03 - $0.05

**Total per sidang**: ~$0.06 - $0.12 (sangat terjangkau!)

**Alternatif GRATIS**:
- Gunakan Groq atau Gemini untuk chat
- Browser TTS/STT sebagai fallback

## 🛠️ Konfigurasi Lanjutan

### Mengubah Model AI

Edit `.env`:

```env
# Untuk OpenAI
OPENAI_MODEL=gpt-4o-mini  # atau gpt-4, gpt-3.5-turbo

# Untuk Groq
GROQ_MODEL=mixtral-8x7b-32768  # atau llama2-70b-4096, gemma-7b-it
```

### Mengubah Voice TTS

Edit `server.js` line 687-690:

```javascript
const mp3 = await openai.audio.speech.create({
  model: "tts-1",
  voice: "nova",  // alloy, echo, fable, onyx, nova, shimmer
  input: text,
});
```

### Custom System Prompt

Edit `server.js` line 152-168 untuk mengubah karakter AI dosen.

## 📁 Struktur Project

```
project03/
├── server.js              # Backend dengan AI integration
├── package.json          # Dependencies
├── .env.example          # Template konfigurasi
├── .env                  # Konfigurasi (buat sendiri)
├── README.md             # Dokumentasi
├── sample-thesis.txt     # Contoh skripsi untuk testing
├── thesis_defense.db     # Database (auto-generated)
├── uploads/              # File skripsi (auto-generated)
└── public/               # Frontend
    ├── index.html        # UI utama
    ├── style.css         # Styling
    └── script.js         # Logic + TTS/STT
```

## 🐛 Troubleshooting

### Problem: "API key not configured"
**Solution**:
- Pastikan file `.env` ada
- API key sudah diisi dengan benar
- Restart server setelah edit `.env`

### Problem: Speech-to-text tidak bekerja
**Solution**:
- Pastikan OpenAI API key tersedia
- Berikan izin mikrofon di browser
- Gunakan HTTPS atau localhost

### Problem: TTS tidak terdengar
**Solution**:
- Periksa volume browser dan sistem
- Set `USE_OPENAI_TTS=false` untuk gunakan browser TTS
- Restart server

### Problem: AI response terlalu lambat
**Solution**:
- Gunakan Groq (lebih cepat, gratis)
- Atau gunakan `gpt-3.5-turbo` (lebih cepat dari gpt-4)
- Kurangi max_tokens di server.js

### Problem: Upload PDF gagal
**Solution**:
- Pastikan file adalah PDF yang valid
- Ukuran max 10MB
- Coba konversi ke TXT

## 🔐 Keamanan

- Jangan commit file `.env` ke git
- Jangan share API key Anda
- Gunakan HTTPS untuk production
- Batasi upload file size
- Validasi input user

## 🚀 Deployment

### Deploy ke Heroku

```bash
# Install Heroku CLI
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set OPENAI_API_KEY=your-key
heroku config:set AI_PROVIDER=openai

# Deploy
git push heroku main
```

### Deploy ke Vercel/Railway

1. Fork repository
2. Import ke Vercel/Railway
3. Set environment variables di dashboard
4. Deploy

## 📚 Resources

- [OpenAI Documentation](https://platform.openai.com/docs)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Groq Documentation](https://console.groq.com/docs)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:

1. Fork repository
2. Buat branch fitur (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📄 License

MIT License - Bebas digunakan untuk tujuan pembelajaran dan pengembangan.

## 🙏 Credits

Dibuat dengan ❤️ untuk membantu mahasiswa mempersiapkan sidang skripsi dengan teknologi AI terkini.

---

**Happy Defending! 🎓✨**

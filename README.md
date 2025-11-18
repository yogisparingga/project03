# 🎓 Simulasi Sidang Skripsi - AI Powered

Aplikasi web untuk simulasi sidang skripsi dengan dosen penguji AI yang dapat memberikan pertanyaan dan evaluasi secara real-time.

## ✨ Fitur Utama

- **Registrasi Mahasiswa**: Sistem registrasi dengan validasi NIM dan nomor HP yang unik
- **Upload Skripsi**: Upload file skripsi dalam format PDF atau TXT
- **Dosen AI Penguji**: AI yang dapat mengajukan pertanyaan berdasarkan konten skripsi
- **Text-to-Speech (TTS)**: Dosen AI berbicara menggunakan teknologi speech synthesis
- **Speech-to-Text**: Mahasiswa dapat menjawab dengan suara (speech recognition)
- **Evaluasi Otomatis**: Sistem penilaian otomatis untuk setiap jawaban
- **Chat Interface**: Antarmuka chat yang interaktif dan user-friendly
- **Scoring System**: Penilaian akhir berdasarkan performa selama sidang

## 🚀 Teknologi yang Digunakan

### Backend
- Node.js
- Express.js
- SQLite3 (Database)
- Multer (File upload)
- PDF-Parse (Ekstraksi teks dari PDF)

### Frontend
- HTML5
- CSS3
- JavaScript (Vanilla)
- Web Speech API (TTS & Speech Recognition)

## 📋 Prasyarat

- Node.js (v14 atau lebih baru)
- npm atau yarn
- Browser modern yang mendukung Web Speech API (Chrome, Edge, Safari)

## 🔧 Instalasi

1. Clone repository ini:
```bash
git clone <repository-url>
cd project03
```

2. Install dependencies:
```bash
npm install
```

3. Buat file `.env` (opsional):
```bash
cp .env.example .env
```

4. Jalankan aplikasi:
```bash
npm start
```

5. Buka browser dan akses:
```
http://localhost:3000
```

## 📖 Cara Penggunaan

### 1. Registrasi
- Buka aplikasi di browser
- Klik tab "Daftar"
- Isi formulir dengan:
  - NIM (harus unik)
  - Nama Lengkap
  - Nomor HP (harus unik)
- Klik "Daftar"

### 2. Login
- Masukkan NIM yang telah didaftarkan
- Klik "Masuk"

### 3. Upload Skripsi
- Di dashboard, klik area upload atau pilih file
- Pilih file skripsi (PDF atau TXT)
- Klik "Upload Skripsi"

### 4. Mulai Sidang
- Setelah upload berhasil, klik tombol "Mulai Sidang"
- Dosen AI akan menyambut dan mengajukan pertanyaan pertama
- Anda dapat:
  - Mengetik jawaban di text area
  - Atau klik tombol 🎤 untuk menjawab dengan suara
- Klik "Kirim" untuk mengirim jawaban
- Dosen AI akan mengevaluasi dan memberikan feedback
- Proses berlanjut dengan pertanyaan berikutnya

### 5. Akhiri Sidang
- Klik tombol "Akhiri Sidang" ketika selesai
- Lihat nilai akhir dan ringkasan sidang

## 🎤 Text-to-Speech & Speech Recognition

### TTS (Text-to-Speech)
Aplikasi menggunakan Web Speech API bawaan browser untuk mengubah teks menjadi suara. Dosen AI akan berbicara dalam bahasa Indonesia.

### Speech Recognition
- Klik tombol 🎤 untuk mulai merekam
- Berbicara dengan jelas
- Ucapan akan dikonversi menjadi teks secara otomatis

**Catatan**:
- Fitur speech recognition bekerja paling baik di Google Chrome
- Pastikan mikrofon sudah diizinkan di browser

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
│  AI Asks    │◄────►│   Student    │
│  Question   │      │   Answers    │
└──────┬──────┘      └──────────────┘
       │
       │ (Repeat)
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
│  & Scoring  │
└─────────────┘
```

## 📊 Database Schema

### students
- id (INTEGER, PRIMARY KEY)
- nim (TEXT, UNIQUE)
- nama (TEXT)
- no_hp (TEXT, UNIQUE)
- created_at (DATETIME)

### thesis_uploads
- id (INTEGER, PRIMARY KEY)
- student_id (INTEGER, FOREIGN KEY)
- filename (TEXT)
- content (TEXT)
- uploaded_at (DATETIME)

### defense_sessions
- id (INTEGER, PRIMARY KEY)
- student_id (INTEGER, FOREIGN KEY)
- thesis_id (INTEGER, FOREIGN KEY)
- started_at (DATETIME)
- ended_at (DATETIME)
- final_score (REAL)
- status (TEXT)

### chat_messages
- id (INTEGER, PRIMARY KEY)
- session_id (INTEGER, FOREIGN KEY)
- sender (TEXT)
- message (TEXT)
- evaluation (TEXT)
- score (REAL)
- created_at (DATETIME)

## 🎯 Sistem Penilaian

Penilaian didasarkan pada:
1. **Panjang Jawaban**: Jawaban yang lebih detail mendapat nilai lebih tinggi
2. **Relevansi Konten**: Penggunaan kata kunci yang relevan
3. **Konsistensi**: Kualitas jawaban sepanjang sidang

**Skala Nilai**:
- A (85-100): Sangat Baik
- B (75-84): Baik
- C (65-74): Cukup
- D (<65): Perlu Perbaikan

## 🔮 Pengembangan Lebih Lanjut

Untuk meningkatkan aplikasi, Anda dapat:

1. **Integrasi AI yang Lebih Canggih**:
   - OpenAI GPT untuk pertanyaan yang lebih kontekstual
   - Google Gemini untuk analisis skripsi
   - Claude API untuk evaluasi yang lebih mendalam

2. **TTS External API**:
   - ElevenLabs untuk suara yang lebih natural
   - Google Cloud TTS
   - Azure Speech Services

3. **Fitur Tambahan**:
   - Video call integration
   - Multiple lecturers
   - Recording playback
   - Detailed analytics
   - Export transcript

## 🛠️ Development Mode

Untuk development dengan auto-reload:

```bash
npm install -g nodemon
npm run dev
```

## 📝 Struktur Project

```
project03/
├── server.js              # Backend server
├── package.json          # Dependencies
├── .env.example          # Environment variables template
├── README.md             # Documentation
├── thesis_defense.db     # SQLite database (auto-generated)
├── uploads/              # Uploaded thesis files (auto-generated)
└── public/               # Frontend files
    ├── index.html        # Main HTML
    ├── style.css         # Styling
    └── script.js         # Frontend logic
```

## 🐛 Troubleshooting

### Masalah: Speech Recognition tidak bekerja
**Solusi**:
- Gunakan Google Chrome atau Microsoft Edge
- Pastikan HTTPS diaktifkan (atau gunakan localhost)
- Berikan izin mikrofon di browser

### Masalah: TTS tidak terdengar
**Solusi**:
- Periksa volume browser dan sistem
- Pastikan browser mendukung Speech Synthesis API
- Coba refresh halaman

### Masalah: Upload PDF gagal
**Solusi**:
- Pastikan file adalah PDF yang valid
- Ukuran file tidak terlalu besar (max ~10MB)
- Coba konversi PDF ke format lain dan upload ulang

## 📄 License

MIT License - Bebas digunakan untuk tujuan pembelajaran dan pengembangan.

## 👥 Kontribusi

Kontribusi sangat diterima! Silakan buat pull request atau laporkan issues.

## 📧 Kontak

Untuk pertanyaan atau saran, silakan buat issue di repository ini.

---

Dibuat dengan ❤️ untuk membantu mahasiswa mempersiapkan sidang skripsi

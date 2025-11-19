# 📝 AI Thesis Corrector - Aplikasi Pengkoreksi Skripsi dengan AI

Aplikasi web untuk membantu mahasiswa mengoreksi dan memperbaiki penulisan skripsi menggunakan bantuan AI (Artificial Intelligence). Aplikasi ini dapat mendeteksi kesalahan typo, tata bahasa, memperbaiki sitasi, parafrase, dan memformat dokumen skripsi secara otomatis.

## 🎯 Fitur Utama

### 1. Autentikasi Multi-Channel
- **Login dengan Google OAuth**: Mahasiswa dapat login menggunakan akun Google mereka
- **Registrasi Manual**: Mahasiswa dapat mendaftar dengan nama dan nomor HP (nomor HP harus unik)
- **Login dengan NIM atau No HP**: Fleksibel dalam metode login

### 2. Upload Dokumen Skripsi
- Support multiple format: **PDF**, **TXT**, dan **DOCX**
- Ekstraksi teks otomatis dari dokumen
- Riwayat file yang telah diupload

### 3. Editor Teks dengan AI
Editor rich-text berbasis Quill dengan fitur lengkap:
- Text formatting (bold, italic, underline, etc.)
- Headers dan font styling
- Lists (ordered & bulleted)
- Alignment dan indentasi
- Insert link dan image
- Code blocks dan blockquotes
- Auto-save setiap 2 detik

### 4. Koreksi AI

#### a. Koreksi Typo & Grammar
- Deteksi kesalahan ejaan (typo)
- Perbaikan tata bahasa Indonesia
- Koreksi penggunaan tanda baca
- Penjelasan detail untuk setiap koreksi

#### b. Parafrase Teks
- Mengubah kalimat dengan gaya formal akademis
- Mempertahankan makna asli
- Meningkatkan keterbacaan
- Saran perbaikan

#### c. Perbaikan Sitasi
- Memeriksa format sitasi (APA, IEEE, dll)
- Identifikasi sitasi yang salah atau tidak lengkap
- Saran bagian yang memerlukan sitasi
- Koreksi otomatis format sitasi

#### d. Format Dokumen
- Strukturisasi dokumen skripsi
- Formatting bab dan sub-bab
- Pengaturan spacing dan indentasi
- Template skripsi standar

### 5. Riwayat Koreksi
- Menyimpan semua koreksi yang dilakukan
- Tracking perubahan dokumen
- Timeline koreksi

### 6. Manajemen Dokumen
- Buat dokumen baru (kosong atau dari file upload)
- Edit multiple dokumen
- Simpan otomatis
- Hapus dokumen

### 7. Admin Dashboard (Bonus dari sistem sebelumnya)
- Kelola data mahasiswa
- Lihat statistik penggunaan
- Pengaturan AI (temperature, max tokens, system prompt)
- Monitor sesi simulasi sidang

## 🛠️ Teknologi yang Digunakan

### Backend
- **Node.js** dengan Express.js
- **SQLite3** untuk database
- **Passport.js** untuk autentikasi Google OAuth
- **Mammoth.js** untuk parsing DOCX
- **pdf-parse** untuk parsing PDF
- **Multer** untuk upload file

### AI Integration
- **OpenAI API** (GPT-4o-mini)
- **Google Gemini API**
- **Groq API** (Mixtral)

### Frontend
- **Quill.js** untuk rich text editor
- **Vanilla JavaScript** (no framework)
- **CSS3** dengan gradients modern

## 📦 Instalasi

### 1. Clone Repository
```bash
git clone <repository-url>
cd project03
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Copy file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Edit file `.env` dan isi dengan API keys Anda:
```env
# Server Configuration
PORT=3000
SESSION_SECRET=your_secret_key_here_change_this

# AI Provider Selection (openai, gemini, or groq)
AI_PROVIDER=openai

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
USE_OPENAI_TTS=true

# Google Gemini Configuration (optional)
GEMINI_API_KEY=your_gemini_api_key

# Groq Configuration (optional - FREE)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=mixtral-8x7b-32768
```

### 4. Setup Google OAuth (Optional)

Untuk mengaktifkan Google OAuth:

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru atau pilih project yang ada
3. Enable **Google+ API**
4. Buat **OAuth 2.0 Credentials**:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
5. Copy **Client ID** dan **Client Secret** ke file `.env`

### 5. Jalankan Aplikasi
```bash
npm start
```

Atau untuk development dengan auto-reload:
```bash
npm run dev
```

Aplikasi akan berjalan di: `http://localhost:3000`

## 🚀 Cara Penggunaan

### Untuk Mahasiswa

#### 1. Login / Registrasi
- **Google OAuth**: Klik tombol "Login dengan Google"
- **Manual**: Daftar dengan nama dan nomor HP, atau login dengan NIM/No HP

#### 2. Upload Skripsi
- Di dashboard, klik "Upload Skripsi"
- Pilih file (PDF, TXT, atau DOCX)
- File akan otomatis diparsing

#### 3. Buka Editor AI
- Klik tombol "Buka Editor AI"
- Buat dokumen baru:
  - Dari file yang sudah diupload, atau
  - Dokumen kosong baru

#### 4. Edit dan Koreksi
- Tulis atau edit teks di editor
- Pilih teks yang ingin dikoreksi (atau biarkan kosong untuk koreksi seluruh dokumen)
- Gunakan fitur AI:
  - **Koreksi Typo & Grammar**: Memperbaiki kesalahan penulisan
  - **Parafrase**: Mengubah kalimat dengan gaya akademis
  - **Perbaiki Sitasi**: Memeriksa dan memperbaiki format sitasi
  - **Format Dokumen**: Mengatur struktur dokumen skripsi

#### 5. Terapkan Koreksi
- Setelah AI memberikan saran, klik "OK" untuk menerapkan
- Dokumen akan otomatis tersimpan

#### 6. Lihat Riwayat
- Panel kanan menampilkan riwayat semua koreksi yang dilakukan

### Untuk Admin

1. Akses: `http://localhost:3000/admin.html`
2. Login dengan kredensial default:
   - Username: `admin`
   - Password: `admin123`
3. Kelola:
   - Data mahasiswa
   - File skripsi yang diupload
   - Sesi sidang (jika menggunakan fitur simulasi)
   - Pengaturan AI

## 📊 Database Schema

### students
```sql
- id: INTEGER PRIMARY KEY
- nim: TEXT UNIQUE (nullable)
- nama: TEXT NOT NULL
- no_hp: TEXT UNIQUE (nullable)
- email: TEXT UNIQUE (nullable)
- google_id: TEXT UNIQUE (nullable)
- status: TEXT DEFAULT 'active'
- created_at: DATETIME
```

### thesis_uploads
```sql
- id: INTEGER PRIMARY KEY
- student_id: INTEGER
- filename: TEXT
- content: TEXT
- file_path: TEXT
- file_type: TEXT (pdf/txt/docx)
- uploaded_at: DATETIME
```

### thesis_documents
```sql
- id: INTEGER PRIMARY KEY
- student_id: INTEGER
- title: TEXT
- content: TEXT (HTML from Quill)
- original_filename: TEXT
- template_type: TEXT
- last_edited: DATETIME
- created_at: DATETIME
```

### correction_history
```sql
- id: INTEGER PRIMARY KEY
- document_id: INTEGER
- correction_type: TEXT (typo/grammar/paraphrase/citation/format)
- original_text: TEXT
- corrected_text: TEXT
- suggestion: TEXT
- applied: BOOLEAN
- created_at: DATETIME
```

## 🔧 API Endpoints

### Authentication
- `POST /api/register` - Registrasi mahasiswa baru
- `POST /api/login` - Login dengan NIM/No HP
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/logout` - Logout

### File Upload
- `POST /api/upload-thesis` - Upload file skripsi
- `GET /api/thesis/:studentId` - Get thesis files

### Documents
- `POST /api/documents/create` - Buat dokumen baru
- `GET /api/documents/:studentId` - Get semua dokumen mahasiswa
- `GET /api/documents/content/:documentId` - Get isi dokumen
- `PUT /api/documents/:documentId` - Update dokumen
- `DELETE /api/documents/:documentId` - Hapus dokumen

### AI Correction
- `POST /api/correct/typo-grammar` - Koreksi typo & grammar
- `POST /api/correct/paraphrase` - Parafrase teks
- `POST /api/correct/citation` - Perbaiki sitasi
- `POST /api/correct/format` - Format dokumen

### Correction History
- `GET /api/corrections/:documentId` - Get riwayat koreksi

## 🎨 Fitur Editor

### Toolbar
- **Text Formatting**: Bold, Italic, Underline, Strike
- **Headers**: H1 - H6
- **Font & Size**: Berbagai pilihan font dan ukuran
- **Colors**: Text color dan background color
- **Lists**: Ordered dan unordered lists
- **Alignment**: Left, center, right, justify
- **Indentation**: Increase/decrease indent
- **Special**: Blockquote, code block
- **Insert**: Link, image
- **Clear Formatting**: Remove all formatting

### Auto-save
- Dokumen otomatis tersimpan setiap 2 detik setelah perubahan
- Indikator "Auto-saved" di console

## 🌟 Keunggulan

1. **Multi-AI Provider**: Support OpenAI, Gemini, dan Groq (gratis)
2. **Offline-capable**: Database lokal (SQLite)
3. **Rich Text Editor**: Editor profesional dengan Quill.js
4. **Real-time Correction**: AI correction dengan response cepat
5. **Correction History**: Track semua perubahan
6. **Multiple Document**: Kelola banyak dokumen sekaligus
7. **Responsive Design**: Mobile-friendly interface
8. **Security**: Session-based authentication dengan Google OAuth

## 🔐 Keamanan

- Session-based authentication dengan express-session
- Password tidak disimpan dalam plain text (untuk admin)
- Google OAuth untuk autentikasi third-party
- Validasi input di backend
- SQL injection protection dengan parameterized queries
- File upload validation (type & size)

## 📝 Catatan Pengembangan

### AI Provider

**GRATIS (Recommended untuk testing):**
- **Groq**: Very fast, generous free tier dengan Mixtral model
- **Gemini**: Google's free tier, good quality

**BERBAYAR (Best quality):**
- **OpenAI**: GPT-4o-mini, best correction quality

### Limitasi

1. **File Size**: Maximum 10MB per file upload
2. **AI Token Limits**: Tergantung provider yang digunakan
3. **Concurrent Users**: SQLite cocok untuk development/small scale

### Development Roadmap

- [ ] Export dokumen ke DOCX dengan format
- [ ] Collaborative editing (multiple users)
- [ ] Version control untuk dokumen
- [ ] Template skripsi yang lebih banyak
- [ ] Integrasi dengan plagiarism checker
- [ ] Mobile app (React Native)

## 🐛 Troubleshooting

### Error: "AI service tidak tersedia"
- Pastikan API key sudah diset di `.env`
- Periksa AI_PROVIDER di `.env` sesuai dengan key yang tersedia
- Cek console log untuk error detail

### Error upload file
- Pastikan folder `uploads/` ada dan writable
- Cek ukuran file (max 10MB)
- Pastikan format file sesuai (.pdf, .txt, .docx)

### Google OAuth tidak bekerja
- Pastikan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` sudah benar
- Periksa callback URL di Google Console sama dengan di `.env`
- Pastikan Google+ API sudah enabled

## 📄 License

MIT License - Silakan gunakan untuk pembelajaran dan pengembangan

## 👨‍💻 Author

Developed with ❤️ for helping students write better thesis

---

**Happy Writing! 📚✨**

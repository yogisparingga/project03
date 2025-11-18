// Global variables
let currentStudent = null;
let currentSession = null;
let thesisContent = '';
let speechSynthesis = window.speechSynthesis;
let recognition = null;
let isRecording = false;

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('answer-input').value = transcript;
        isRecording = false;
        updateMicButton();
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        updateMicButton();
        showMessage('Error: Gagal mengenali suara. Pastikan mikrofon aktif.', 'error');
    };

    recognition.onend = () => {
        isRecording = false;
        updateMicButton();
    };
}

// Tab switching
function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
        tabs[1].classList.add('active');
    }
    document.getElementById('auth-message').innerHTML = '';
}

// Registration
async function register() {
    const nim = document.getElementById('reg-nim').value.trim();
    const nama = document.getElementById('reg-nama').value.trim();
    const no_hp = document.getElementById('reg-hp').value.trim();

    if (!nim || !nama || !no_hp) {
        showMessage('Semua field harus diisi!', 'error');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nim, nama, no_hp })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Registrasi berhasil! Silakan login.', 'success');
            setTimeout(() => switchTab('login'), 2000);
        } else {
            showMessage(data.error || 'Registrasi gagal', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Terjadi kesalahan saat mendaftar', 'error');
    }
}

// Login
async function login() {
    const nim = document.getElementById('login-nim').value.trim();

    if (!nim) {
        showMessage('NIM harus diisi!', 'error');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nim })
        });

        const data = await response.json();

        if (response.ok) {
            currentStudent = data.student;
            showDashboard();
        } else {
            showMessage(data.error || 'Login gagal', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Terjadi kesalahan saat login', 'error');
    }
}

// Logout
function logout() {
    currentStudent = null;
    currentSession = null;
    thesisContent = '';
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('login-nim').value = '';
}

// Show Dashboard
function showDashboard() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('student-info').textContent =
        `${currentStudent.nama} (${currentStudent.nim})`;

    loadThesisList();
}

// Handle file selection
function handleFileSelect() {
    const fileInput = document.getElementById('thesis-file');
    const fileName = document.getElementById('file-name');
    const uploadBtn = document.getElementById('upload-btn');

    if (fileInput.files.length > 0) {
        fileName.textContent = fileInput.files[0].name;
        uploadBtn.disabled = false;
    } else {
        fileName.textContent = 'Pilih file PDF atau TXT';
        uploadBtn.disabled = true;
    }
}

// Upload thesis
async function uploadThesis() {
    const fileInput = document.getElementById('thesis-file');
    const file = fileInput.files[0];

    if (!file) {
        alert('Pilih file terlebih dahulu');
        return;
    }

    const formData = new FormData();
    formData.append('thesis', file);
    formData.append('studentId', currentStudent.id);

    try {
        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const response = await fetch('/api/upload-thesis', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            alert('File berhasil diupload!');
            fileInput.value = '';
            document.getElementById('file-name').textContent = 'Pilih file PDF atau TXT';
            loadThesisList();
        } else {
            alert(data.error || 'Upload gagal');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Terjadi kesalahan saat upload');
    } finally {
        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Skripsi';
    }
}

// Load thesis list
async function loadThesisList() {
    try {
        const response = await fetch(`/api/thesis/${currentStudent.id}`);
        const data = await response.json();

        const thesisList = document.getElementById('thesis-list');

        if (data.theses && data.theses.length > 0) {
            thesisList.innerHTML = '<h3 style="margin-top: 30px;">📚 Skripsi Anda</h3>';

            data.theses.forEach(thesis => {
                const date = new Date(thesis.uploaded_at).toLocaleDateString('id-ID');
                const item = document.createElement('div');
                item.className = 'thesis-item';
                item.innerHTML = `
                    <div class="thesis-info">
                        <h4>📄 ${thesis.filename}</h4>
                        <small>Diupload pada ${date}</small>
                    </div>
                    <button onclick="startDefense(${thesis.id})" class="btn btn-primary">
                        Mulai Sidang
                    </button>
                `;
                thesisList.appendChild(item);
            });
        } else {
            thesisList.innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading thesis list:', error);
    }
}

// Start defense session
async function startDefense(thesisId) {
    try {
        const response = await fetch('/api/start-defense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: currentStudent.id,
                thesisId: thesisId
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentSession = {
                id: data.sessionId,
                thesisId: thesisId
            };
            thesisContent = data.thesisContent;

            showDefenseSession();

            // Generate first question
            setTimeout(() => generateQuestion(), 1000);
        } else {
            alert(data.error || 'Gagal memulai sidang');
        }
    } catch (error) {
        console.error('Start defense error:', error);
        alert('Terjadi kesalahan saat memulai sidang');
    }
}

// Show defense session
function showDefenseSession() {
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('defense-section').style.display = 'block';
    document.getElementById('session-info').textContent =
        `Mahasiswa: ${currentStudent.nama}`;

    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('answer-input').value = '';

    addSystemMessage('Selamat datang di sidang skripsi virtual. Dosen penguji akan segera memulai.');
}

// Generate AI question
async function generateQuestion() {
    try {
        setAIStatus('Berpikir...', true);

        const response = await fetch('/api/generate-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSession.id,
                thesisContent: thesisContent,
                previousMessages: []
            })
        });

        const data = await response.json();

        if (response.ok) {
            addMessage('dosen', data.question);
            speakText(data.question);
            setAIStatus('Mendengarkan...', false);
        } else {
            console.error('Question generation failed:', data.error);
            setAIStatus('Error', false);
        }
    } catch (error) {
        console.error('Generate question error:', error);
        setAIStatus('Error', false);
    }
}

// Submit student answer
async function submitAnswer() {
    const answerInput = document.getElementById('answer-input');
    const answer = answerInput.value.trim();

    if (!answer) {
        alert('Silakan isi jawaban Anda');
        return;
    }

    // Add student message to chat
    addMessage('mahasiswa', answer);
    answerInput.value = '';

    setAIStatus('Mengevaluasi...', true);

    try {
        const response = await fetch('/api/submit-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSession.id,
                answer: answer,
                thesisContent: thesisContent
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Show evaluation
            showEvaluation(data.evaluation);

            // Generate next question
            setTimeout(() => generateQuestion(), 2000);
        } else {
            console.error('Answer submission failed:', data.error);
            setAIStatus('Error', false);
        }
    } catch (error) {
        console.error('Submit answer error:', error);
        setAIStatus('Error', false);
    }
}

// Toggle speech recognition
function toggleSpeechRecognition() {
    if (!recognition) {
        alert('Speech recognition tidak didukung di browser Anda');
        return;
    }

    if (isRecording) {
        recognition.stop();
        isRecording = false;
    } else {
        recognition.start();
        isRecording = true;
    }

    updateMicButton();
}

// Update mic button appearance
function updateMicButton() {
    const micBtn = document.getElementById('mic-btn');
    if (isRecording) {
        micBtn.classList.add('recording');
        micBtn.title = 'Berhenti merekam';
    } else {
        micBtn.classList.remove('recording');
        micBtn.title = 'Bicara';
    }
}

// Text to speech
function speakText(text) {
    if (!speechSynthesis) {
        console.error('Speech synthesis not supported');
        return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
        setAIStatus('Berbicara...', true);
    };

    utterance.onend = () => {
        setAIStatus('Mendengarkan...', false);
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setAIStatus('Mendengarkan...', false);
    };

    speechSynthesis.speak(utterance);
}

// Set AI status
function setAIStatus(status, isActive) {
    const statusElement = document.getElementById('ai-status');
    statusElement.textContent = status;

    if (isActive) {
        statusElement.classList.add('speaking');
    } else {
        statusElement.classList.remove('speaking');
    }
}

// Add message to chat
function addMessage(sender, message) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${sender}`;

    const avatar = sender === 'dosen' ? '👨‍🏫' : '👨‍🎓';
    const senderName = sender === 'dosen' ? 'Dr. AI Penguji' : currentStudent.nama;
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar">${avatar}</div>
            <span class="message-sender">${senderName}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${message}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add system message
function addSystemMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.style.textAlign = 'center';
    messageDiv.style.padding = '10px';
    messageDiv.style.color = '#666';
    messageDiv.style.fontSize = '14px';
    messageDiv.innerHTML = `<em>${message}</em>`;
    chatMessages.appendChild(messageDiv);
}

// Show evaluation
function showEvaluation(evaluation) {
    const chatMessages = document.getElementById('chat-messages');
    const lastMessage = chatMessages.lastElementChild;

    const evalDiv = document.createElement('div');
    evalDiv.className = 'message-evaluation';
    evalDiv.innerHTML = `
        <strong>📊 Evaluasi:</strong><br>
        ${evaluation.feedback}<br>
        <span class="score-badge">Nilai: ${evaluation.score}/100</span>
    `;

    lastMessage.appendChild(evalDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Update current evaluation box
    const evalBox = document.getElementById('current-evaluation');
    evalBox.innerHTML = `
        <h4>Evaluasi Terakhir</h4>
        <p>${evaluation.feedback}</p>
        <div class="score-badge">Nilai: ${evaluation.score}/100</div>
    `;

    // Speak evaluation
    speakText(evaluation.feedback);
}

// End defense session
async function endDefense() {
    if (!confirm('Apakah Anda yakin ingin mengakhiri sidang?')) {
        return;
    }

    try {
        const response = await fetch('/api/end-defense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSession.id
            })
        });

        const data = await response.json();

        if (response.ok) {
            showResults(data.finalScore);
        } else {
            alert(data.error || 'Gagal mengakhiri sidang');
        }
    } catch (error) {
        console.error('End defense error:', error);
        alert('Terjadi kesalahan saat mengakhiri sidang');
    }
}

// Show results
function showResults(finalScore) {
    document.getElementById('defense-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';

    document.getElementById('final-score').textContent = finalScore;

    const score = parseFloat(finalScore);
    let grade = '';
    if (score >= 85) grade = 'A - Sangat Baik';
    else if (score >= 75) grade = 'B - Baik';
    else if (score >= 65) grade = 'C - Cukup';
    else grade = 'D - Perlu Perbaikan';

    document.getElementById('score-grade').textContent = grade;

    const summary = document.getElementById('session-summary');
    summary.innerHTML = `
        <h3>Ringkasan Sidang</h3>
        <p><strong>Mahasiswa:</strong> ${currentStudent.nama}</p>
        <p><strong>NIM:</strong> ${currentStudent.nim}</p>
        <p><strong>Nilai Akhir:</strong> ${finalScore}</p>
        <p><strong>Grade:</strong> ${grade}</p>
        <p style="margin-top: 20px;">
            Terima kasih telah mengikuti simulasi sidang skripsi.
            Terus berlatih untuk meningkatkan kemampuan presentasi dan menjawab pertanyaan Anda!
        </p>
    `;

    // Speak results
    speakText(`Sidang selesai. Nilai akhir Anda adalah ${finalScore}. ${grade}`);
}

// Back to dashboard
function backToDashboard() {
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    currentSession = null;
    thesisContent = '';
    loadThesisList();
}

// Start new defense
function startNewDefense() {
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    currentSession = null;
    thesisContent = '';
}

// Show message
function showMessage(message, type) {
    const messageElement = document.getElementById('auth-message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
}

// Enter key support for inputs
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    document.getElementById('login-nim')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    // Answer input
    document.getElementById('answer-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitAnswer();
        }
    });
});

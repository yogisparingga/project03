// Global admin state
let currentAdmin = null;
let currentStats = null;

// Admin Login
async function adminLogin() {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value.trim();

    if (!username || !password) {
        showLoginMessage('Username dan password harus diisi!', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentAdmin = data.admin;
            showDashboard();
            loadDashboardStats();
        } else {
            showLoginMessage(data.error || 'Login gagal', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginMessage('Terjadi kesalahan saat login', 'error');
    }
}

// Show Dashboard
function showDashboard() {
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('admin-dashboard-section').style.display = 'flex';
    document.getElementById('admin-name').textContent = currentAdmin.nama;
}

// Admin Logout
function adminLogout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        currentAdmin = null;
        document.getElementById('admin-login-section').style.display = 'block';
        document.getElementById('admin-dashboard-section').style.display = 'none';
        document.getElementById('admin-username').value = '';
        document.getElementById('admin-password').value = '';
    }
}

// Show Login Message
function showLoginMessage(message, type) {
    const messageElement = document.getElementById('admin-login-message');
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
}

// Show Tab
function showTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.style.display = 'none');

    // Remove active class from all menu items
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => item.classList.remove('active'));

    // Show selected tab
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    // Add active class to clicked menu item
    event.target.closest('.menu-item').classList.add('active');

    // Load data for the tab
    switch(tabName) {
        case 'dashboard':
            loadDashboardStats();
            break;
        case 'students':
            loadStudents();
            break;
        case 'thesis':
            loadThesisFiles();
            break;
        case 'sessions':
            loadSessions();
            break;
        case 'ai-settings':
            loadAISettings();
            break;
    }
}

// Load Dashboard Statistics
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();

        if (response.ok) {
            currentStats = data.stats;
            document.getElementById('stat-students').textContent = data.stats.totalStudents;
            document.getElementById('stat-thesis').textContent = data.stats.totalThesis;
            document.getElementById('stat-sessions').textContent = data.stats.totalSessions;
            document.getElementById('stat-completed').textContent = data.stats.completedSessions;
            document.getElementById('stat-avg-score').textContent = data.stats.averageScore;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load Students
async function loadStudents() {
    try {
        const response = await fetch('/api/admin/students');
        const data = await response.json();

        if (response.ok) {
            renderStudentsTable(data.students);
        }
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

// Render Students Table
function renderStudentsTable(students) {
    const tbody = document.getElementById('students-table-body');

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Belum ada data mahasiswa</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => {
        const date = new Date(student.created_at).toLocaleDateString('id-ID');
        const statusClass = student.status === 'active' ? 'status-active' : 'status-inactive';

        return `
            <tr>
                <td>${student.nim}</td>
                <td>${student.nama}</td>
                <td>${student.no_hp}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${student.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                </td>
                <td>${student.thesis_count}</td>
                <td>${student.session_count}</td>
                <td>${date}</td>
                <td>
                    <button onclick="toggleStudentStatus(${student.id}, '${student.status}')" class="btn btn-sm btn-primary">
                        ${student.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button onclick="deleteStudent(${student.id}, '${student.nama}')" class="btn btn-sm btn-delete">
                        Hapus
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Toggle Student Status
async function toggleStudentStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    try {
        const response = await fetch(`/api/admin/students/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            loadStudents();
        } else {
            alert(data.error || 'Gagal mengupdate status');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan');
    }
}

// Delete Student
async function deleteStudent(id, name) {
    if (!confirm(`Apakah Anda yakin ingin menghapus mahasiswa "${name}"?\n\nSemua data terkait (file skripsi, sesi sidang) akan ikut terhapus.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/students/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            loadStudents();
            loadDashboardStats();
        } else {
            alert(data.error || 'Gagal menghapus mahasiswa');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan');
    }
}

// Load Thesis Files
async function loadThesisFiles() {
    try {
        const response = await fetch('/api/admin/thesis');
        const data = await response.json();

        if (response.ok) {
            renderThesisTable(data.files);
        }
    } catch (error) {
        console.error('Error loading thesis files:', error);
    }
}

// Render Thesis Table
function renderThesisTable(files) {
    const tbody = document.getElementById('thesis-table-body');

    if (files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Belum ada file skripsi</td></tr>';
        return;
    }

    tbody.innerHTML = files.map(file => {
        const date = new Date(file.uploaded_at).toLocaleDateString('id-ID');

        return `
            <tr>
                <td>📄 ${file.filename}</td>
                <td>${file.student_name}</td>
                <td>${file.nim}</td>
                <td>${file.session_count}</td>
                <td>${date}</td>
                <td>
                    <button onclick="deleteThesisFile(${file.id}, '${file.filename}')" class="btn btn-sm btn-delete">
                        Hapus
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Delete Thesis File
async function deleteThesisFile(id, filename) {
    if (!confirm(`Apakah Anda yakin ingin menghapus file "${filename}"?\n\nSemua sesi sidang terkait akan ikut terhapus.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/thesis/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            loadThesisFiles();
            loadDashboardStats();
        } else {
            alert(data.error || 'Gagal menghapus file');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan');
    }
}

// Load Sessions
async function loadSessions() {
    try {
        const response = await fetch('/api/admin/sessions');
        const data = await response.json();

        if (response.ok) {
            renderSessionsTable(data.sessions);
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

// Render Sessions Table
function renderSessionsTable(sessions) {
    const tbody = document.getElementById('sessions-table-body');

    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Belum ada sesi sidang</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(session => {
        const startDate = new Date(session.started_at).toLocaleString('id-ID');
        const endDate = session.ended_at ? new Date(session.ended_at).toLocaleString('id-ID') : '-';
        const statusClass = session.status === 'completed' ? 'status-completed' : 'status-ongoing';
        const score = session.final_score ? session.final_score.toFixed(2) : '-';

        return `
            <tr>
                <td>#${session.id}</td>
                <td>${session.student_name}</td>
                <td>${session.nim}</td>
                <td>${session.thesis_filename}</td>
                <td>${startDate}</td>
                <td>${endDate}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${session.status === 'completed' ? 'Selesai' : 'Berlangsung'}
                    </span>
                </td>
                <td><strong>${score}</strong></td>
                <td>
                    <button onclick="viewSessionDetail(${session.id})" class="btn btn-sm btn-view">
                        Detail
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// View Session Detail
async function viewSessionDetail(sessionId) {
    try {
        const response = await fetch(`/api/admin/sessions/${sessionId}`);
        const data = await response.json();

        if (response.ok) {
            showSessionDetailModal(data.session);
        } else {
            alert('Gagal memuat detail sesi');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan');
    }
}

// Show Session Detail Modal
function showSessionDetailModal(session) {
    const modal = document.getElementById('session-modal');
    const content = document.getElementById('session-detail-content');

    const startDate = new Date(session.started_at).toLocaleString('id-ID');
    const endDate = session.ended_at ? new Date(session.ended_at).toLocaleString('id-ID') : 'Belum selesai';

    let html = `
        <div class="session-info">
            <p><strong>ID Sesi:</strong> #${session.id}</p>
            <p><strong>Mahasiswa:</strong> ${session.student_name} (${session.nim})</p>
            <p><strong>No. HP:</strong> ${session.no_hp}</p>
            <p><strong>File Skripsi:</strong> ${session.thesis_filename}</p>
            <p><strong>Mulai:</strong> ${startDate}</p>
            <p><strong>Selesai:</strong> ${endDate}</p>
            <p><strong>Status:</strong> ${session.status === 'completed' ? 'Selesai' : 'Berlangsung'}</p>
            <p><strong>Nilai Akhir:</strong> ${session.final_score ? session.final_score.toFixed(2) : '-'}</p>
        </div>

        <div class="chat-history">
            <h3>Riwayat Percakapan</h3>
    `;

    if (session.messages && session.messages.length > 0) {
        session.messages.forEach(msg => {
            const time = new Date(msg.created_at).toLocaleTimeString('id-ID');
            const senderLabel = msg.sender === 'dosen' ? '👨‍🏫 Dosen AI' : '👨‍🎓 Mahasiswa';

            html += `
                <div class="history-message ${msg.sender}">
                    <strong>${senderLabel} <small>(${time})</small></strong>
                    <p>${msg.message}</p>
            `;

            if (msg.evaluation && msg.sender === 'mahasiswa') {
                let evaluation = msg.evaluation;
                if (typeof evaluation === 'string') {
                    try {
                        evaluation = JSON.parse(evaluation);
                    } catch (e) {
                        // Keep as string
                    }
                }

                if (typeof evaluation === 'object') {
                    html += `
                        <div class="eval">
                            <strong>Evaluasi:</strong>
                            <p>${evaluation.feedback}</p>
                            ${evaluation.strengths ? `<p><strong>Kelebihan:</strong> ${evaluation.strengths}</p>` : ''}
                            ${evaluation.improvements ? `<p><strong>Saran:</strong> ${evaluation.improvements}</p>` : ''}
                            <span class="score">Nilai: ${msg.score}/100</span>
                        </div>
                    `;
                }
            }

            html += '</div>';
        });
    } else {
        html += '<p>Belum ada percakapan</p>';
    }

    html += '</div>';

    content.innerHTML = html;
    modal.style.display = 'block';
}

// Close Session Modal
function closeSessionModal() {
    document.getElementById('session-modal').style.display = 'none';
}

// Load AI Settings
async function loadAISettings() {
    try {
        const response = await fetch('/api/admin/ai-settings');
        const data = await response.json();

        if (response.ok) {
            const settings = data.settings;
            document.getElementById('ai-name').value = settings.ai_name || '';
            document.getElementById('system-prompt').value = settings.system_prompt || '';
            document.getElementById('temperature').value = settings.temperature || '0.7';
            document.getElementById('max-tokens').value = settings.max_tokens || '300';
            document.getElementById('temp-value').textContent = settings.temperature || '0.7';
            document.getElementById('tokens-value').textContent = settings.max_tokens || '300';
        }
    } catch (error) {
        console.error('Error loading AI settings:', error);
    }
}

// Save AI Settings
async function saveAISettings() {
    const settings = {
        ai_name: document.getElementById('ai-name').value,
        system_prompt: document.getElementById('system-prompt').value,
        temperature: document.getElementById('temperature').value,
        max_tokens: document.getElementById('max-tokens').value
    };

    if (!settings.system_prompt.trim()) {
        alert('System prompt tidak boleh kosong!');
        return;
    }

    try {
        const response = await fetch('/api/admin/ai-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
        } else {
            alert(data.error || 'Gagal menyimpan pengaturan');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan');
    }
}

// Enter key support
document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');

    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') adminLogin();
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') adminLogin();
        });
    }

    // Close modal when clicking outside
    window.onclick = (event) => {
        const modal = document.getElementById('session-modal');
        if (event.target === modal) {
            closeSessionModal();
        }
    };
});

// Global variables
let quill;
let currentStudent = null;
let currentDocument = null;
let saveTimeout = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Get student info from localStorage
    const studentData = localStorage.getItem('studentData');
    if (!studentData) {
        window.location.href = '/';
        return;
    }

    currentStudent = JSON.parse(studentData);
    document.getElementById('student-info').textContent = `Mahasiswa: ${currentStudent.nama}`;

    // Initialize Quill editor
    initializeEditor();

    // Load documents
    await loadDocuments();

    // Load thesis files for the modal
    await loadThesisFiles();
});

// Initialize Quill editor
function initializeEditor() {
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean']
    ];

    quill = new Quill('#editor', {
        modules: {
            toolbar: toolbarOptions
        },
        theme: 'snow',
        placeholder: 'Mulai menulis skripsi Anda di sini...'
    });

    // Auto-save on content change
    quill.on('text-change', () => {
        if (currentDocument) {
            // Debounce auto-save
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                autoSaveDocument();
            }, 2000);
        }
    });
}

// Load documents
async function loadDocuments() {
    try {
        const response = await fetch(`/api/documents/${currentStudent.id}`);
        const data = await response.json();

        if (data.success) {
            const documentList = document.getElementById('document-list');
            documentList.innerHTML = '';

            if (data.documents.length === 0) {
                documentList.innerHTML = '<li style="padding: 10px; color: #6c757d;">Belum ada dokumen</li>';
                return;
            }

            data.documents.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'document-item';
                li.innerHTML = `
                    <div style="font-weight: 600;">${doc.title}</div>
                    <div style="font-size: 12px; color: #6c757d;">
                        ${new Date(doc.last_edited).toLocaleDateString('id-ID')}
                    </div>
                `;
                li.onclick = () => loadDocument(doc.id);
                documentList.appendChild(li);
            });

            // Load first document if available
            if (data.documents.length > 0 && !currentDocument) {
                loadDocument(data.documents[0].id);
            }
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        showMessage('Error memuat dokumen', 'error');
    }
}

// Load thesis files for modal
async function loadThesisFiles() {
    try {
        const response = await fetch(`/api/thesis/${currentStudent.id}`);
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('thesis-select');
            select.innerHTML = '<option value="">-- Pilih File --</option>';

            data.theses.forEach(thesis => {
                const option = document.createElement('option');
                option.value = thesis.id;
                option.textContent = thesis.filename;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading thesis files:', error);
    }
}

// Load document
async function loadDocument(documentId) {
    try {
        const response = await fetch(`/api/documents/content/${documentId}`);
        const data = await response.json();

        if (data.success) {
            currentDocument = data.document;
            document.getElementById('document-title').value = data.document.title;
            quill.root.innerHTML = data.document.content;

            // Update active state in sidebar
            document.querySelectorAll('.document-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.closest('.document-item')?.classList.add('active');

            // Load correction history
            loadCorrectionHistory(documentId);
        }
    } catch (error) {
        console.error('Error loading document:', error);
        showMessage('Error memuat dokumen', 'error');
    }
}

// Save document
async function saveDocument() {
    if (!currentDocument) {
        showMessage('Tidak ada dokumen yang dipilih', 'error');
        return;
    }

    try {
        const content = quill.root.innerHTML;
        const title = document.getElementById('document-title').value;

        const response = await fetch(`/api/documents/${currentDocument.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, title })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('Dokumen berhasil disimpan', 'success');
            currentDocument.content = content;
            currentDocument.title = title;
            await loadDocuments();
        } else {
            showMessage(data.error || 'Error menyimpan dokumen', 'error');
        }
    } catch (error) {
        console.error('Error saving document:', error);
        showMessage('Error menyimpan dokumen', 'error');
    }
}

// Auto-save document
async function autoSaveDocument() {
    if (!currentDocument) return;

    try {
        const content = quill.root.innerHTML;
        const title = document.getElementById('document-title').value;

        await fetch(`/api/documents/${currentDocument.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, title })
        });

        console.log('Auto-saved');
    } catch (error) {
        console.error('Error auto-saving:', error);
    }
}

// Show new document modal
function showNewDocumentModal() {
    document.getElementById('new-document-modal').classList.add('active');
}

// Close new document modal
function closeNewDocumentModal() {
    document.getElementById('new-document-modal').classList.remove('active');
    document.getElementById('thesis-select').value = '';
    document.getElementById('new-document-title').value = '';
}

// Create document
async function createDocument() {
    const thesisId = document.getElementById('thesis-select').value;
    const title = document.getElementById('new-document-title').value;

    if (!thesisId && !title) {
        showMessage('Pilih file atau masukkan judul dokumen', 'error');
        return;
    }

    try {
        let response;

        if (thesisId) {
            // Create from uploaded thesis
            response = await fetch('/api/documents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: currentStudent.id,
                    thesisId: thesisId
                })
            });
        } else {
            // Create empty document
            response = await fetch('/api/documents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: currentStudent.id,
                    thesisId: null,
                    title: title
                })
            });
        }

        const data = await response.json();

        if (data.success) {
            showMessage('Dokumen berhasil dibuat', 'success');
            closeNewDocumentModal();
            await loadDocuments();
            loadDocument(data.documentId);
        } else {
            showMessage(data.error || 'Error membuat dokumen', 'error');
        }
    } catch (error) {
        console.error('Error creating document:', error);
        showMessage('Error membuat dokumen', 'error');
    }
}

// AI Correction Functions

async function correctTypoGrammar() {
    if (!currentDocument) {
        showMessage('Tidak ada dokumen yang dipilih', 'error');
        return;
    }

    const selection = quill.getSelection();
    let text;

    if (selection && selection.length > 0) {
        text = quill.getText(selection.index, selection.length);
    } else {
        text = quill.getText();
    }

    if (!text.trim()) {
        showMessage('Tidak ada teks untuk dikoreksi', 'error');
        return;
    }

    showLoading('Memeriksa typo dan grammar...');

    try {
        const response = await fetch('/api/correct/typo-grammar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                documentId: currentDocument.id
            })
        });

        const data = await response.json();

        if (data.success) {
            displayCorrectionResult(data.result, 'Typo & Grammar');

            // Ask user if they want to apply corrections
            if (confirm('Apakah Anda ingin menerapkan koreksi ini?')) {
                if (selection && selection.length > 0) {
                    quill.deleteText(selection.index, selection.length);
                    quill.insertText(selection.index, data.result.corrected_text);
                } else {
                    quill.setText(data.result.corrected_text);
                }
                await saveDocument();
            }

            await loadCorrectionHistory(currentDocument.id);
        } else {
            showMessage(data.error || 'Error melakukan koreksi', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error melakukan koreksi', 'error');
    }
}

async function paraphraseText() {
    if (!currentDocument) {
        showMessage('Tidak ada dokumen yang dipilih', 'error');
        return;
    }

    const selection = quill.getSelection();
    if (!selection || selection.length === 0) {
        showMessage('Pilih teks yang ingin diparafrase', 'error');
        return;
    }

    const text = quill.getText(selection.index, selection.length);

    if (!text.trim()) {
        showMessage('Tidak ada teks untuk diparafrase', 'error');
        return;
    }

    showLoading('Memparafrase teks...');

    try {
        const response = await fetch('/api/correct/paraphrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                documentId: currentDocument.id,
                style: 'formal akademis'
            })
        });

        const data = await response.json();

        if (data.success) {
            displayCorrectionResult(data.result, 'Parafrase');

            if (confirm('Apakah Anda ingin menerapkan hasil parafrase?')) {
                quill.deleteText(selection.index, selection.length);
                quill.insertText(selection.index, data.result.paraphrased_text);
                await saveDocument();
            }

            await loadCorrectionHistory(currentDocument.id);
        } else {
            showMessage(data.error || 'Error melakukan parafrase', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error melakukan parafrase', 'error');
    }
}

async function correctCitation() {
    if (!currentDocument) {
        showMessage('Tidak ada dokumen yang dipilih', 'error');
        return;
    }

    const selection = quill.getSelection();
    let text;

    if (selection && selection.length > 0) {
        text = quill.getText(selection.index, selection.length);
    } else {
        text = quill.getText();
    }

    if (!text.trim()) {
        showMessage('Tidak ada teks untuk diperiksa', 'error');
        return;
    }

    showLoading('Memeriksa sitasi...');

    try {
        const response = await fetch('/api/correct/citation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                documentId: currentDocument.id,
                citationStyle: 'APA'
            })
        });

        const data = await response.json();

        if (data.success) {
            displayCorrectionResult(data.result, 'Sitasi');

            if (data.result.corrected_text && confirm('Apakah Anda ingin menerapkan perbaikan sitasi?')) {
                if (selection && selection.length > 0) {
                    quill.deleteText(selection.index, selection.length);
                    quill.insertText(selection.index, data.result.corrected_text);
                } else {
                    quill.setText(data.result.corrected_text);
                }
                await saveDocument();
            }

            await loadCorrectionHistory(currentDocument.id);
        } else {
            showMessage(data.error || 'Error memeriksa sitasi', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error memeriksa sitasi', 'error');
    }
}

async function formatDocument() {
    if (!currentDocument) {
        showMessage('Tidak ada dokumen yang dipilih', 'error');
        return;
    }

    const text = quill.getText();

    if (!text.trim()) {
        showMessage('Tidak ada teks untuk diformat', 'error');
        return;
    }

    showLoading('Memformat dokumen...');

    try {
        const response = await fetch('/api/correct/format', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                documentId: currentDocument.id,
                template: 'standard'
            })
        });

        const data = await response.json();

        if (data.success) {
            displayCorrectionResult(data.result, 'Format');

            if (confirm('Apakah Anda ingin menerapkan format ini?')) {
                quill.setText(data.result.formatted_text);
                await saveDocument();
            }

            await loadCorrectionHistory(currentDocument.id);
        } else {
            showMessage(data.error || 'Error memformat dokumen', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error memformat dokumen', 'error');
    }
}

// Display correction result
function displayCorrectionResult(result, type) {
    const resultDiv = document.getElementById('correction-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<h4>Hasil ${type}:</h4>`;

    if (result.corrected_text || result.paraphrased_text || result.formatted_text) {
        const text = result.corrected_text || result.paraphrased_text || result.formatted_text;
        resultDiv.innerHTML += `
            <div class="correction-item">
                <div class="correction-type">Teks Hasil:</div>
                <div class="correction-text">${text.substring(0, 500)}${text.length > 500 ? '...' : ''}</div>
            </div>
        `;
    }

    if (result.corrections && result.corrections.length > 0) {
        resultDiv.innerHTML += '<h5>Detail Koreksi:</h5>';
        result.corrections.forEach(corr => {
            resultDiv.innerHTML += `
                <div class="correction-item">
                    <div class="correction-type">${corr.type}</div>
                    <div class="correction-text">
                        <strong>Asli:</strong> ${corr.original}<br>
                        <strong>Perbaikan:</strong> ${corr.corrected}<br>
                        <small>${corr.explanation}</small>
                    </div>
                </div>
            `;
        });
    }

    if (result.summary) {
        resultDiv.innerHTML += `
            <div class="correction-item">
                <div class="correction-type">Ringkasan:</div>
                <div class="correction-text">${result.summary}</div>
            </div>
        `;
    }

    if (result.improvements) {
        resultDiv.innerHTML += `
            <div class="correction-item">
                <div class="correction-type">Perbaikan:</div>
                <div class="correction-text">${Array.isArray(result.improvements) ? result.improvements.join(', ') : result.improvements}</div>
            </div>
        `;
    }

    if (result.citations_found && result.citations_found.length > 0) {
        resultDiv.innerHTML += '<h5>Sitasi Ditemukan:</h5>';
        result.citations_found.forEach(cit => {
            resultDiv.innerHTML += `
                <div class="correction-item">
                    <div class="correction-text">
                        <strong>Asli:</strong> ${cit.original}<br>
                        <strong>Perbaikan:</strong> ${cit.corrected}<br>
                        <small>Masalah: ${cit.issues.join(', ')}</small>
                    </div>
                </div>
            `;
        });
    }
}

// Load correction history
async function loadCorrectionHistory(documentId) {
    try {
        const response = await fetch(`/api/corrections/${documentId}`);
        const data = await response.json();

        if (data.success) {
            const historyDiv = document.getElementById('correction-history');
            historyDiv.innerHTML = '';

            if (data.corrections.length === 0) {
                historyDiv.innerHTML = '<p style="color: #6c757d; font-size: 12px;">Belum ada koreksi</p>';
                return;
            }

            data.corrections.forEach(corr => {
                const div = document.createElement('div');
                div.className = 'history-item';
                div.innerHTML = `
                    <div class="history-type">${corr.correction_type}</div>
                    <div style="font-size: 11px; color: #6c757d;">
                        ${new Date(corr.created_at).toLocaleString('id-ID')}
                    </div>
                `;
                historyDiv.appendChild(div);
            });
        }
    } catch (error) {
        console.error('Error loading correction history:', error);
    }
}

// Show loading
function showLoading(message) {
    const resultDiv = document.getElementById('correction-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div class="loading">${message}</div>`;
}

// Show message
function showMessage(message, type) {
    const resultDiv = document.getElementById('correction-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div class="message ${type}">${message}</div>`;

    setTimeout(() => {
        resultDiv.style.display = 'none';
    }, 3000);
}

// Back to dashboard
function backToDashboard() {
    window.location.href = '/';
}

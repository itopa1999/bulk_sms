(function() {
  "use strict";

  // ---------- IMPORT RECIPIENTS MODAL ----------
  const importModal = document.getElementById('importModal');
  const importRecipientBtn = document.getElementById('importRecipientBtn');
  const closeImportModal = document.getElementById('closeImportModal');
  const cancelImportBtn = document.getElementById('cancelImportBtn');
  const confirmImportBtn = document.getElementById('confirmImportBtn');
  const dragDropArea = document.getElementById('dragDropArea');
  const fileInput = document.getElementById('fileInput');
  const importPreview = document.getElementById('importPreview');
  const importColumns = document.getElementById('importColumns');
  
  let csvData = [];
  let csvColumns = [];

  const defaultDragDropHtml = dragDropArea.innerHTML;
  const EMAIL_COLUMNS = ['email', 'Email', 'EMAIL', 'e-mail', 'E-Mail', 'recipient'];

  // Open import modal
  importRecipientBtn.addEventListener('click', (e) => {
    e.preventDefault();
    importModal.classList.add('active');
    resetImportModal();
  });

  // Close import modal
  closeImportModal.addEventListener('click', () => {
    importModal.classList.remove('active');
  });

  cancelImportBtn.addEventListener('click', () => {
    importModal.classList.remove('active');
  });

  // Close modal when clicking outside
  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) {
      importModal.classList.remove('active');
    }
  });

  // Browse files button. The button is recreated during reset, so delegate from the drop area.
  dragDropArea.addEventListener('click', (e) => {
    if (e.target.closest('#fileBrowseBtn')) {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Handle file selection
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadFileToBackend(file);
    }
  });

  // Drag and drop handlers
  dragDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropArea.classList.add('dragover');
  });

  dragDropArea.addEventListener('dragleave', () => {
    dragDropArea.classList.remove('dragover');
  });

  dragDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFileToBackend(file);
    }
  });

  // Upload file to backend
  function uploadFileToBackend(file) {
    // Validate file type
    const fileType = file.name.split('.').pop().toLowerCase();
    if (fileType !== 'csv' && fileType !== 'xlsx' && fileType !== 'xls') {
      alert('⚠️ Invalid file format. Please upload a CSV or Excel file.');
      return;
    }

    // Show loading state
    dragDropArea.innerHTML = '<i class="fas fa-spinner fa-spin"></i><h3>Processing file...</h3>';
    dragDropArea.style.pointerEvents = 'none';

    // Create FormData and send to backend
    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:8000/api/email/upload-csv/', {
      method: 'POST',
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          csvColumns = data.columns;
          csvData = data.data;
          showImportPreview(data);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      })
      .catch(error => {
        console.error('Error uploading file:', error);
        alert(`⚠️ Error processing file:\n${error.message}\n\nMake sure the backend is running on http://localhost:8000`);
        resetImportModal();
      });
  }

  // Show import preview with statistics and columns
  function showImportPreview(data) {
    dragDropArea.style.display = 'none';
    dragDropArea.style.pointerEvents = 'auto';
    dragDropArea.innerHTML = defaultDragDropHtml;
    importPreview.style.display = 'block';

    document.getElementById('totalEmails').textContent = data.row_count;
    document.getElementById('newEmails').textContent = data.columns.length;

    const emailColumn = data.columns.find(col => EMAIL_COLUMNS.includes(col));
    const emailColumnStat = document.getElementById('duplicateEmails');
    emailColumnStat.textContent = emailColumn ? 'Yes' : 'No';
    emailColumnStat.className = emailColumn ? 'value new' : 'value duplicate';

    let columnsHtml = '<h5><i class="fas fa-columns"></i> Available Columns</h5>';
    columnsHtml += '<div class="import-column-list">';

    data.columns.forEach(col => {
      columnsHtml += `<span class="import-column-token">{${escapeHtml(col)}}</span>`;
    });

    columnsHtml += '</div>';

    if (!emailColumn) {
      columnsHtml += '<div class="import-warning"><i class="fas fa-exclamation-triangle"></i> No email column detected. Rename one column to email, Email, EMAIL, e-mail, E-Mail, or recipient before sending.</div>';
    }

    importColumns.innerHTML = columnsHtml;

    confirmImportBtn.style.display = 'flex';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Confirm and import emails
  confirmImportBtn.addEventListener('click', () => {
    // Call main.js function to add CSV data
    if (window.importCSVData) {
      window.importCSVData(csvData, csvColumns);
    }
    importModal.classList.remove('active');
    alert(`✓ Successfully imported ${csvData.length} row(s)\n\nUse {column_name} placeholders in subject and body for personalization!`);
  });

  // Reset import modal
  function resetImportModal() {
    dragDropArea.style.display = 'block';
    dragDropArea.style.pointerEvents = 'auto';
    importPreview.style.display = 'none';
    importColumns.innerHTML = '';
    confirmImportBtn.style.display = 'none';
    csvData = [];
    csvColumns = [];
    fileInput.value = '';
    dragDropArea.classList.remove('dragover');
    dragDropArea.innerHTML = defaultDragDropHtml;
  }
})();

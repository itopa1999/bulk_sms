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
  const fileBrowseBtn = document.getElementById('fileBrowseBtn');
  const importPreview = document.getElementById('importPreview');
  
  let emailsToImport = [];
  let duplicateEmails = [];

  // Function to validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Get recipients from the recipients chips container
  function getExistingRecipients() {
    const chipsContainer = document.getElementById('recipientChips');
    const recipients = [];
    const emailChips = chipsContainer.querySelectorAll('.email-chip span');
    emailChips.forEach(chip => {
      const email = chip.textContent.trim();
      if (email) {
        recipients.push(email);
      }
    });
    return recipients;
  }

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

  // Browse files button
  fileBrowseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      parseFile(file);
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
      parseFile(file);
    }
  });

  // Parse file and extract emails
  function parseFile(file) {
    // Check file type
    const fileType = file.name.split('.').pop().toLowerCase();
    
    if (fileType === 'xlsx' || fileType === 'xls') {
      // Check if XLSX library is loaded, with a brief retry
      if (typeof XLSX === 'undefined') {
        // Wait briefly for library to load
        setTimeout(() => {
          if (typeof XLSX === 'undefined') {
            alert('⚠️ Excel library not loaded.\n\n1. Check your internet connection\n2. Refresh the page\n3. Try again');
            console.error('XLSX library not available after retry. Window.XLSX:', typeof window.XLSX);
            resetImportModal();
          } else {
            parseExcelFile(file);
          }
        }, 500);
        return;
      }
      // Parse Excel file
      parseExcelFile(file);
    } else if (fileType === 'csv') {
      // Parse CSV file
      parseCSVFile(file);
    } else {
      alert('⚠️ Invalid file format. Please upload a CSV or Excel file.');
    }
  }

  // Parse CSV file
  function parseCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        // Extract emails from each line
        const extractedEmails = [];
        
        lines.forEach((line) => {
          // Handle CSV format (email might be in different columns)
          const cells = line.split(',').map(cell => cell.trim());
          
          cells.forEach(cell => {
            if (isValidEmail(cell)) {
              extractedEmails.push(cell);
            }
          });
        });

        if (extractedEmails.length === 0) {
          alert('⚠️ No valid emails found in the CSV file.');
          resetImportModal();
        } else {
          checkDuplicates(extractedEmails);
        }
      } catch (error) {
        alert('⚠️ Error parsing CSV file. Please check the file format.');
        console.error('CSV parsing error:', error);
      }
    };
    reader.onerror = () => {
      alert('⚠️ Error reading the file. Please try again.');
    };
    reader.readAsText(file);
  }

  // Parse Excel file
  function parseExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const extractedEmails = [];

        // Process all sheets
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Flatten and extract emails from all cells
          jsonData.forEach(row => {
            if (Array.isArray(row)) {
              row.forEach(cell => {
                if (cell !== null && cell !== undefined && cell !== '') {
                  const cellValue = String(cell).trim();
                  if (cellValue && isValidEmail(cellValue)) {
                    extractedEmails.push(cellValue);
                  }
                }
              });
            }
          });
        });

        if (extractedEmails.length === 0) {
          alert('⚠️ No valid emails found in the Excel file.');
          resetImportModal();
        } else {
          checkDuplicates(extractedEmails);
        }
      } catch (error) {
        alert('⚠️ Error parsing Excel file. Please ensure it is a valid .xlsx file.\n\nTechnical error: ' + error.message);
        console.error('Excel parsing error:', error);
      }
    };
    reader.onerror = () => {
      alert('⚠️ Error reading the file. Please try again.');
    };
    reader.readAsArrayBuffer(file);
  }

  // Check for duplicates with existing recipients
  function checkDuplicates(importedEmails) {
    const existingRecipients = getExistingRecipients();
    const validEmails = [];
    duplicateEmails = [];

    importedEmails.forEach(email => {
      const emailLower = email.toLowerCase();
      const isDuplicate = existingRecipients.some(existing => existing.toLowerCase() === emailLower);
      
      if (isDuplicate) {
        duplicateEmails.push(email);
      } else if (!validEmails.includes(emailLower)) {
        validEmails.push(emailLower);
      }
    });

    emailsToImport = validEmails;
    showImportPreview();
  }

  // Show import preview with statistics
  function showImportPreview() {
    dragDropArea.style.display = 'none';
    importPreview.style.display = 'block';

    document.getElementById('totalEmails').textContent = emailsToImport.length + duplicateEmails.length;
    document.getElementById('newEmails').textContent = emailsToImport.length;
    document.getElementById('duplicateEmails').textContent = duplicateEmails.length;

    if (duplicateEmails.length > 0) {
      const duplicateList = document.getElementById('duplicateList');
      const duplicateItemsList = document.getElementById('duplicateItemsList');
      duplicateItemsList.innerHTML = '';
      
      duplicateEmails.slice(0, 5).forEach(email => {
        const li = document.createElement('li');
        li.textContent = email;
        duplicateItemsList.appendChild(li);
      });

      if (duplicateEmails.length > 5) {
        const li = document.createElement('li');
        li.textContent = `... and ${duplicateEmails.length - 5} more`;
        duplicateItemsList.appendChild(li);
      }

      duplicateList.style.display = 'block';
    }

    confirmImportBtn.style.display = 'flex';
  }

  // Confirm and import emails
  confirmImportBtn.addEventListener('click', () => {
    // Call main.js function to add emails
    if (window.addImportedEmails) {
      window.addImportedEmails(emailsToImport);
    }
    importModal.classList.remove('active');
    alert(`✓ Successfully imported ${emailsToImport.length} email(s)`);
  });

  // Reset import modal
  function resetImportModal() {
    dragDropArea.style.display = 'block';
    importPreview.style.display = 'none';
    confirmImportBtn.style.display = 'none';
    emailsToImport = [];
    duplicateEmails = [];
    fileInput.value = '';
    dragDropArea.classList.remove('dragover');
  }
})();

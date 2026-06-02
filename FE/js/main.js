(function() {
  "use strict";

  // ---------- PARTICLE ANIMATION (Github-style background) ----------
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];

  const PARTICLE_COUNT = 90;
  const MAX_SPEED = 0.15; // subtle movement
  const CONNECTION_DISTANCE = 150; // not used, but we keep particles soft

  function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * MAX_SPEED,
        vy: (Math.random() - 0.5) * MAX_SPEED,
        radius: Math.random() * 2.5 + 1,   // 1 - 3.5 px
        opacity: Math.random() * 0.3 + 0.1, // 0.1 - 0.4
      });
    }
  }

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initParticles();
  }

  function drawParticles() {
    ctx.clearRect(0, 0, width, height);

    // Check if light mode is active
    const isLightMode = document.body.classList.contains('light-mode');
    
    // Set particle colors based on theme
    const particleColor = isLightMode ? 'rgba(100, 150, 200, ' : 'rgba(200, 220, 255, '; // darker blue for light mode
    const lineColor = isLightMode ? 'rgba(0, 120, 180, ' : 'rgba(0, 255, 255, '; // darker cyan for light mode
    const lineAlpha = isLightMode ? '0.05)' : '0.03)';

    // update and draw each particle
    for (let p of particles) {
      // move
      p.x += p.vx;
      p.y += p.vy;

      // wrap around edges (subtle, so they don't disappear)
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      // draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = particleColor + p.opacity + ')';
      ctx.fill();
    }

    // optional faint connections (for GitHub-style) – very subtle
    ctx.lineWidth = 0.8;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const connectionAlpha = isLightMode ? 0.03 : 0.015;
          ctx.strokeStyle = lineColor + (connectionAlpha * (1 - dist/90)) + ')';
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(drawParticles);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  resizeCanvas();
  drawParticles();

  // ---------- RECIPIENT EMAIL MANAGEMENT ----------
  let recipients = [];
  let csvData = null;  // Store CSV data for personalization
  let csvColumns = [];  // Store available columns
  const recipientInput = document.getElementById('recipients');
  const addRecipientBtn = document.getElementById('addRecipientBtn');
  const recipientChips = document.getElementById('recipientChips');
  const recipientCount = document.getElementById('recipientCount');
  const removeAllBtn = document.getElementById('removeAllBtn');
  const csvImportStatus = document.getElementById('csvImportStatus');
  const personalizationPanel = document.getElementById('personalizationPanel');
  const personalizationMeta = document.getElementById('personalizationMeta');
  const columnTokenList = document.getElementById('columnTokenList');
  const subjectInput = document.getElementById('subject');
  const bodyInput = document.getElementById('body');
  const subjectPreview = document.getElementById('subjectPreview');
  const bodyPreview = document.getElementById('bodyPreview');
  const clearCsvBtn = document.getElementById('clearCsvBtn');
  let lastTemplateInput = bodyInput;

  // Validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Add recipient email
  function addRecipient() {
    const email = recipientInput.value.trim();
    
    if (!email) {
      alert('⚠️ Please enter an email address');
      return;
    }

    if (!isValidEmail(email)) {
      alert('⚠️ Please enter a valid email address');
      return;
    }

    if (recipients.includes(email)) {
      alert('⚠️ This email is already in the list');
      return;
    }

    recipients.push(email);
    recipientInput.value = '';
    updateRecipientDisplay();
  }

  // Remove recipient email
  function removeRecipient(email) {
    recipients = recipients.filter(e => e !== email);
    updateRecipientDisplay();
  }

  // Remove all recipients
  function removeAllRecipients() {
    if (recipients.length === 0) {
      return;
    }
    if (confirm(`⚠️ Remove all ${recipients.length} recipient(s)?`)) {
      recipients = [];
      updateRecipientDisplay();
    }
  }

  // Update recipient chips display
  function updateRecipientDisplay() {
    recipientChips.innerHTML = '';
    
    if (recipients.length === 0) {
      recipientChips.classList.add('empty');
      recipientChips.innerHTML = '<span>No recipients added yet</span>';
      removeAllBtn.style.display = 'none';
    } else {
      recipientChips.classList.remove('empty');
      recipients.forEach(email => {
        const chip = document.createElement('div');
        chip.className = 'email-chip';
        chip.innerHTML = `
          <span>${email}</span>
          <button type="button" class="remove-email" onclick="removeRecipient('${email}')" title="Remove">
            <i class="fas fa-times"></i>
          </button>
        `;
        recipientChips.appendChild(chip);
      });
      removeAllBtn.style.display = 'flex';
    }

    // Update count
    recipientCount.textContent = `Total: ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`;
  }

  function replaceTemplateVariables(template, rowData) {
    if (!template || !rowData) {
      return template || '';
    }

    return template.replace(/\{([^{}]+)\}/g, (match, columnName) => {
      return Object.prototype.hasOwnProperty.call(rowData, columnName)
        ? String(rowData[columnName] ?? '')
        : match;
    });
  }

  function updatePersonalizationPreview() {
    if (!csvData || csvData.length === 0) {
      return;
    }

    const firstRow = csvData[0];
    subjectPreview.textContent = replaceTemplateVariables(subjectInput.value.trim(), firstRow) || 'Subject preview will appear here';
    bodyPreview.textContent = replaceTemplateVariables(bodyInput.value.trim(), firstRow) || 'Body preview will appear here';
  }

  function insertAtCursor(input, text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.focus();
    input.setSelectionRange(start + text.length, start + text.length);
    updatePersonalizationPreview();
  }

  function renderCsvImportState() {
    const hasCsvData = csvData && csvData.length > 0;
    csvImportStatus.hidden = !hasCsvData;
    personalizationPanel.hidden = !hasCsvData;

    if (!hasCsvData) {
      csvImportStatus.innerHTML = '';
      personalizationMeta.textContent = 'No CSV data imported';
      columnTokenList.innerHTML = '';
      subjectPreview.textContent = 'Import a CSV to preview personalization';
      bodyPreview.textContent = 'Import a CSV to preview personalization';
      return;
    }

    const emailColumn = csvColumns.find(col =>
      ['email', 'Email', 'EMAIL', 'e-mail', 'E-Mail', 'recipient'].includes(col)
    );

    csvImportStatus.innerHTML = `<strong>${csvData.length}</strong> CSV row${csvData.length !== 1 ? 's' : ''} ready${emailColumn ? ` using <strong>${emailColumn}</strong>` : ''}`;
    personalizationMeta.textContent = `${csvData.length} row${csvData.length !== 1 ? 's' : ''} imported. Click a token to insert it into the template.`;

    columnTokenList.innerHTML = '';
    csvColumns.forEach(column => {
      const token = document.createElement('button');
      token.type = 'button';
      token.className = 'column-token';
      token.textContent = `{${column}}`;
      token.title = `Insert {${column}}`;
      token.addEventListener('click', () => {
        insertAtCursor(lastTemplateInput, `{${column}}`);
      });
      columnTokenList.appendChild(token);
    });

    updatePersonalizationPreview();
  }

  function clearCsvImport() {
    csvData = null;
    csvColumns = [];
    renderCsvImportState();
  }

  // Add recipient on button click
  addRecipientBtn.addEventListener('click', (e) => {
    e.preventDefault();
    addRecipient();
    recipientInput.focus();
  });

  // Add recipient on Enter key
  recipientInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  });

  // Remove all recipients on button click
  removeAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    removeAllRecipients();
  });

  subjectInput.addEventListener('input', updatePersonalizationPreview);
  bodyInput.addEventListener('input', updatePersonalizationPreview);
  subjectInput.addEventListener('focus', () => {
    lastTemplateInput = subjectInput;
  });
  bodyInput.addEventListener('focus', () => {
    lastTemplateInput = bodyInput;
  });
  clearCsvBtn.addEventListener('click', clearCsvImport);

  // Make removeRecipient global so onclick works
  window.removeRecipient = removeRecipient;

  // ---------- FLOATING ICONS (optional liveliness) ----------
  const iconContainer = document.getElementById('floatingIcons');
  // create 8 random floating icons with Font Awesome
  const iconClasses = ['fa-envelope', 'fa-paper-plane', 'fa-inbox', 'fa-envelope-open-text', 'fa-mail-bulk', 'fa-star', 'fa-message', 'fa-share'];
  const positions = [
    { top: '12%', left: '5%' }, { top: '78%', left: '92%' }, { top: '33%', left: '88%' }, { top: '67%', left: '7%' },
    { top: '22%', left: '75%' }, { top: '93%', left: '20%' }, { top: '45%', left: '15%' }, { top: '8%', left: '85%' },
    { top: '55%', left: '45%' }, { top: '82%', left: '55%' }
  ];
  // add a few more with random delays
  for (let i = 0; i < 12; i++) {
    const icon = document.createElement('i');
    const randIcon = iconClasses[Math.floor(Math.random() * iconClasses.length)];
    icon.className = `fas ${randIcon}`;
    // random top/left within viewport
    icon.style.top = Math.random() * 100 + '%';
    icon.style.left = Math.random() * 100 + '%';
    icon.style.fontSize = (Math.random() * 2.5 + 1.5) + 'rem';
    icon.style.animationDuration = (Math.random() * 10 + 12) + 's';
    icon.style.animationDelay = (Math.random() * 5) + 's';
    icon.style.opacity = 0.02 + Math.random() * 0.03; // very subtle
    icon.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
    iconContainer.appendChild(icon);
  }

  // ---------- FORM SUBMIT - SEND TO BACKEND API ----------
  const form = document.getElementById('emailForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Gather form data
    const sender = document.getElementById('sender').value.trim() || null;
    const ccInput = document.getElementById('cc').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const body = document.getElementById('body').value.trim();

    // Validation
    if (!subject) {
      alert('⚠️ Subject is required');
      return;
    }

    if (!body) {
      alert('⚠️ Message body is required');
      return;
    }

    if (csvData && csvData.length > 0) {
      // CSV data loaded - no need for manual recipients
      // Check if CSV has email column
      const hasEmailColumn = csvColumns.some(col =>
        ['email', 'Email', 'EMAIL', 'e-mail', 'E-Mail', 'recipient'].includes(col)
      );
      if (!hasEmailColumn) {
        alert('⚠️ CSV data must have an email column (named: email, Email, or EMAIL)');
        return;
      }
    } else if (recipients.length === 0) {
      alert('⚠️ Please either:\n1. Import CSV data using "Import Recipients" button, OR\n2. Add at least one recipient manually');
      return;
    }

    // Parse CC field (comma-separated emails)
    const cc = ccInput 
      ? ccInput.split(',').map(email => email.trim()).filter(email => email && isValidEmail(email))
      : null;

    if (ccInput && cc.length === 0) {
      alert('⚠️ Please enter valid CC email addresses (comma-separated)');
      return;
    }

    // Prepare API payload
    const payload = {
      sender: sender,
      subject: subject,
      body: body
    };

    // If CSV data is loaded, use it for personalization; otherwise use manual recipients
    if (csvData && csvData.length > 0) {
      payload.csv_data = csvData;
      payload.cc = cc && cc.length > 0 ? cc : null;
    } else {
      payload.recipients = recipients;
      payload.cc = cc && cc.length > 0 ? cc : null;
    }

    // Show sending animation
    const btn = e.target.querySelector('.submit-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>sending...</span> <i class="fas fa-circle-notch fa-spin"></i>';
    btn.disabled = true;

    try {
      // Send to backend API
      const response = await fetch('http://localhost:8000/api/email/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok || response.status === 202) {
        // Success
        btn.innerHTML = '<span>✓ sent</span> <i class="fas fa-check"></i>';
        const isLightMode = document.body.classList.contains('light-mode');
        const successColor = isLightMode ? '#27ae60' : '#2ecc71';
        btn.style.background = successColor;
        btn.style.boxShadow = `0 0 25px ${successColor}`;

        // Show success details
        console.log('✅ Email queued successfully', {
          task_id: data.task_id,
          log_id: data.log_id,
          message: data.message
        });

        // Reset form after 2s
        setTimeout(() => {
          // Reset button
          btn.innerHTML = originalText;
          const accentColor = isLightMode ? '#0088cc' : '#00FFFF';
          btn.style.background = accentColor;
          btn.style.boxShadow = '0 10px 20px -8px rgba(0, 255, 255, 0.3)';
          btn.disabled = false;

          // Reset form
          form.reset();
          recipients = [];
          csvData = null;
          csvColumns = [];
          updateRecipientDisplay();
          renderCsvImportState();

          alert(`✅ Email queued for sending!\nTask ID: ${data.task_id}\n\nCheck status with task ID in the backend.`);
        }, 2000);
      } else {
        // Error from API
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error sending email:', error);
      
      btn.innerHTML = '<span>✗ failed</span> <i class="fas fa-times"></i>';
      const isLightMode = document.body.classList.contains('light-mode');
      const errorColor = isLightMode ? '#c0392b' : '#e74c3c';
      btn.style.background = errorColor;
      btn.style.boxShadow = `0 0 25px ${errorColor}`;

      setTimeout(() => {
        btn.innerHTML = originalText;
        const accentColor = isLightMode ? '#0088cc' : '#00FFFF';
        btn.style.background = accentColor;
        btn.style.boxShadow = '0 10px 20px -8px rgba(0, 255, 255, 0.3)';
        btn.disabled = false;
      }, 3000);

      alert(`❌ Error sending email:\n${error.message}\n\nMake sure the backend is running on http://localhost:8000`);
    }
  });

  // ---------- additional tiny hover effect on card (already in css) ----------
  // Also ensure input animation on label: handled by :focus-within in style

  // ---------- DARK MODE / LIGHT MODE TOGGLE ----------
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');
  const html = document.documentElement;
  const body = document.body;

  // Check localStorage for saved theme preference
  const savedTheme = localStorage.getItem('theme-preference');
  if (savedTheme === 'light') {
    body.classList.add('light-mode');
    themeLabel.textContent = 'Dark';
    themeToggle.querySelector('i').className = 'fas fa-sun';
  } else {
    // Dark mode is default
    body.classList.remove('light-mode');
    themeLabel.textContent = 'Light';
    themeToggle.querySelector('i').className = 'fas fa-moon';
    localStorage.setItem('theme-preference', 'dark');
  }

  // Toggle theme on click
  themeToggle.addEventListener('click', () => {
    const isLightMode = body.classList.contains('light-mode');
    
    if (isLightMode) {
      // Switch to dark mode
      body.classList.remove('light-mode');
      localStorage.setItem('theme-preference', 'dark');
      themeLabel.textContent = 'Light';
      themeToggle.querySelector('i').className = 'fas fa-moon';
    } else {
      // Switch to light mode
      body.classList.add('light-mode');
      localStorage.setItem('theme-preference', 'light');
      themeLabel.textContent = 'Dark';
      themeToggle.querySelector('i').className = 'fas fa-sun';
    }
  });

  // ---------- MODAL COMMUNICATION ----------
  // Function to add imported emails - called by modal.js
  window.addImportedEmails = function(emailsToAdd) {
    emailsToAdd.forEach(email => {
      if (!recipients.includes(email)) {
        recipients.push(email);
      }
    });
    updateRecipientDisplay();
  };

  window.importCSVData = function(importedRows, importedColumns) {
    csvData = Array.isArray(importedRows) ? importedRows : [];
    csvColumns = Array.isArray(importedColumns) ? importedColumns : [];
    renderCsvImportState();
  };

  // Initialize modal with current recipients
  if (window.setRecipientsRef) {
    window.setRecipientsRef(recipients);
  }

  renderCsvImportState();
})();

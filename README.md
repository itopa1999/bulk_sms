# Bulk Email Sender (Tkinter + Celery + Redis)

A production-ready desktop bulk email sender using Tkinter for UI, Celery for background processing, and Redis as broker/result backend. The UI remains responsive and submits email tasks to Celery without blocking.

## Features
- CSV import for recipients
- Subject and body editor with personalization placeholders (e.g., `{name}`, `{email}`)
- Start/Stop campaign controls
- Real-time progress (total, sent, failed, pending)
- Celery retries and rate limiting
- SMTP with TLS/SSL
- File logging

## Project Structure
```
app/
  __init__.py
  celery_app.py
  config.py
  email_service.py
  logging_config.py
  tasks.py
  ui.py
  utils.py
logs/
main.py
requirements.txt
.env.example
```

## Setup

### 1. Create and Activate Virtual Environment

**Windows (PowerShell):**
```
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```
python -m venv venv
.\venv\Scripts\activate.bat
```

**macOS/Linux:**
```
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies
```
pip install -r requirements.txt
```

### 3. Configure Environment
Copy `.env.example` to `.env` and update values:
   - Redis URL (default: redis://localhost:6379/0)
   - SMTP credentials (host, port, username, password)
   - Rate limit (default: 50/m)

## Running Redis
Start your Redis service (or container). For example:
```
redis-server
```

## Running Celery Worker
**Make sure to activate venv first, then:**

Windows:
```
celery -A app.celery_app.celery_app worker -l info -P solo
```

macOS/Linux:
```
celery -A app.celery_app.celery_app worker -l info
```

## Running the Desktop App
**Make sure to activate venv first, then:**
```
python main.py
```

## CSV Format
Your CSV should include at least an `email` column, and can include any additional fields for personalization:
```
email,name
user1@example.com,Alex
user2@example.com,Jamie
```

Use placeholders like `{name}` and `{email}` in subject/body.

## Notes
- Each recipient is handled as an individual Celery task.
- Failed emails are retried automatically up to 3 times.
- Logs are written to `logs/app.log`.

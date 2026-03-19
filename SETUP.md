# Bulk Email Backend Setup & Usage

## Overview
This backend implements a Django REST API with Celery for asynchronous bulk email sending. The system:
- Receives email requests from the frontend
- Queues them with Celery for background processing
- Handles fallback defaults when sender/cc are null
- Tracks email sending status with database logging

## Project Structure
```
backend/
  bulk_email/
    __init__.py          (Celery initialization)
    celery.py           (Celery app configuration)
    settings.py         (Django settings with Celery & email config)
    urls.py             (URL routing)
  email_service/
    models.py           (EmailLog model for tracking)
    views.py            (API endpoints)
    tasks.py            (Celery tasks for sending emails)
    urls.py             (App URL routing)
  manage.py
```

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
pip install -r ../requirements.txt
```

### 2. Configure Environment Variables
Edit `.env` file with your email credentials:
```env
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

**Gmail Setup:**
- Use App Passwords, not your regular password
- Enable 2-factor authentication
- Generate App Password here: https://myaccount.google.com/apppasswords

### 3. Create Database Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 4. Start Redis Server
```bash
# Windows with Redis installed
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

### 5. Start Celery Worker
```bash
celery -A bulk_email worker -l info
```

### 6. Start Django Development Server
```bash
python manage.py runserver
```

## API Endpoints

### Send Bulk Email
**POST** `/api/email/send/`

Request body:
```json
{
  "sender": "user@example.com",     // Optional (null uses DEFAULT_FROM_EMAIL)
  "recipients": [                    // Required
    "recipient1@example.com",
    "recipient2@example.com"
  ],
  "cc": ["cc@example.com"],          // Optional (null uses DEFAULT_CC_EMAILS)
  "subject": "Email Subject",        // Required
  "body": "Email content here..."    // Required
}
```

Response (202 Accepted):
```json
{
  "success": true,
  "message": "Email queued for sending",
  "task_id": "abc123def456",
  "log_id": 1
}
```

### Check Email Status
**GET** `/api/email/status/<task_id>/`

Response:
```json
{
  "task_id": "abc123def456",
  "status": "SUCCESS",
  "log_status": "sent",
  "error_message": null
}
```

## Fallback Behavior

### Sender Fallback
If `sender` is null or empty:
- Falls back to `DEFAULT_FROM_EMAIL` from `.env`

### CC Fallback
If `cc` is null or empty:
- Falls back to `DEFAULT_CC_EMAILS` from `.env` (comma-separated)
- If `DEFAULT_CC_EMAILS` is empty, no default CC is added

## Frontend Integration

### Example JavaScript Request
```javascript
fetch('http://localhost:8000/api/email/send/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sender: 'salawulucky08071@gmail.com',  // Or null
    recipients: [
      'salawulucky08071@gmail.com',
      'starlitecodedev@gmail.com'
    ],
    cc: 'salawulucky@gmail.com',  // Or null/empty
    subject: 'Reactivation of domain name',
    body: 'Email content...'
  })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

## Database Schema

The `EmailLog` model tracks all email sending attempts:
- `sender`: Email address of sender
- `recipients`: List of recipient emails (JSON)
- `cc`: List of CC emails (JSON)
- `subject`: Email subject
- `body`: Email content
- `status`: pending | sent | failed
- `task_id`: Celery task ID for tracking
- `created_at`: Timestamp
- `updated_at`: Last update timestamp
- `error_message`: Failure reason (if failed)

## Running in Production

### Use Gunicorn
```bash
gunicorn bulk_email.wsgi:application --bind 0.0.0.0:8000
```

### Use PostgreSQL Instead of SQLite
Update `settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'bulk_email_db',
        'USER': 'postgres',
        'PASSWORD': 'password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### Use Celery Beat for Scheduled Tasks (Optional)
```bash
celery -A bulk_email beat -l info
```

## Troubleshooting

### Issue: "No module named 'email_service'"
- Solution: Make sure you've run `python manage.py migrate` and the app is in `INSTALLED_APPS`

### Issue: Celery tasks not executing
- Solution: Ensure Redis is running and `CELERY_BROKER_URL` is correct

### Issue: Emails not sending
- Solution: Check `.env` credentials and `EMAIL_BACKEND` setting
- Verify SMTP credentials are correct
- Check Django logs for error details

### Check Email Logs
```bash
python manage.py shell
from email_service.models import EmailLog
EmailLog.objects.all().values()
```

## Security Notes
- ⚠️ Never commit `.env` with real credentials to git
- Use environment variables for all sensitive data
- Enable CORS only for trusted origins
- Consider rate limiting for production

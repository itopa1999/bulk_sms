# Frontend-Backend Integration Guide

## Quick Start

### 1. Database Setup
```bash
cd backend
python manage.py makemigrations email_service
python manage.py migrate
```

### 2. Start Redis
```bash
# Use Docker
docker run -d --name redis-email -p 6379:6379 redis:latest

# OR Windows with WSL2
redis-server
```

### 3. Start Celery Worker (Backend Directory)
```bash
cd backend
celery -A bulk_email worker -l info --pool=solo
```

### 4. Start Django (New Terminal, Backend Directory)
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

### 5. Open Frontend
- Open the HTML file directly in your browser
- Or use a simple HTTP server:
```bash
cd FE
python -m http.server 8080
```
Then visit `http://localhost:8080`

---

## API Endpoint

### Send Bulk Email
```
POST http://localhost:8000/api/email/send/
Content-Type: application/json
```

**No authentication required**

**Request Body:**
```json
{
  "sender": "optional@email.com",
  "recipients": ["user1@example.com", "user2@example.com"],
  "cc": ["cc@example.com"],
  "subject": "Test Subject",
  "body": "Email content here"
}
```

**Success Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Email queued for sending",
  "task_id": "abc123...",
  "log_id": 1
}
```

**Error Response (400):**
```json
{
  "error": "recipients field is required"
}
```

---

## Frontend Configuration

The frontend is configured to send requests to:
```
http://localhost:8000/api/email/send/
```

### Update API URL
If your backend is on a different address, update this in `FE/js/main.js`:

```javascript
const response = await fetch('http://localhost:8000/api/email/send/', {
```

### Common Frontend Ports:
- **Live Server** (VS Code): `http://localhost:5500`
- **Python HTTP Server**: `http://localhost:8080`
- **npm dev server**: `http://localhost:3000`

---

## Feature Details

### Sender Email Handling
- **Provided**: Uses the sender email from form
- **Empty/Null**: Falls back to `DEFAULT_FROM_EMAIL` from `.env`

### CC Handling
- **Provided**: Comma-separated emails (e.g., `cc1@example.com, cc2@example.com`)
- **Empty/Null**: Falls back to `DEFAULT_CC_EMAILS` from `.env`
- **Both empty**: No CC applied

### Recipients
- Multiple emails can be added using the "Add" button
- Bulk import via CSV or Excel file
- Duplicates are automatically detected and prevented

### Message Status
- Frontend shows real-time feedback with animations
- Task ID is provided for tracking
- Check status via database: `EmailLog` model in Django admin

---

## Testing the API with curl

```bash
# Test endpoint
curl -X POST http://localhost:8000/api/email/send/ \
  -H "Content-Type: application/json" \
  -d '{
    "sender": null,
    "recipients": ["test@example.com"],
    "cc": null,
    "subject": "Test Email",
    "body": "This is a test email"
  }'
```

---

## Troubleshooting

### Frontend → 404 Not Found
- ✅ Verify backend is running on `http://localhost:8000`
- ✅ Check that `python manage.py migrate` was executed
- ✅ Verify `email_service` is in `INSTALLED_APPS`

### CORS Errors
- ✅ Check `CORS_ALLOWED_ORIGINS` in `settings.py`
- ✅ Ensure frontend URL is in the allowed list
- ✅ Restart Django after making changes

### Celery Tasks Not Running
- ✅ Verify Redis is running (`redis-cli ping`)
- ✅ Check Celery worker logs for errors
- ✅ Verify `CELERY_BROKER_URL` points to correct Redis instance

### Emails Not Sending
- ✅ Check `.env` email credentials
- ✅ Verify `EMAIL_BACKEND` is not set to `console` in production
- ✅ Check Django logs: `python manage.py shell` → `EmailLog.objects.all()`

---

## Example Frontend Form Data

```javascript
{
  "sender": "newsletter@yourcompany.com",  // Optional
  "recipients": [
    "john@example.com",
    "jane@example.com",
    "admin@example.com"
  ],
  "cc": "cc@example.com",  // Can be comma-separated
  "subject": "Welcome to Our Newsletter",
  "body": "Hello,\n\nWelcome to our service!\n\nBest regards,\nTeam"
}
```

---

## Security Notes
⚠️ **Development Only Settings:**
- CSRF exemption on `send_email` view (marked with `@csrf_exempt`)
- No authentication required
- Debug mode enabled

For production:
- Remove `@csrf_exempt` decorator
- Add proper authentication
- Use environment variables for all secrets
- Enable HTTPS
- Validate email domains
- Implement rate limiting

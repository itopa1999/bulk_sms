import json
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import os
from .models import EmailLog
from .tasks import send_bulk_emails

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def send_email(request):
    """
    API endpoint to send bulk emails
    
    Expected JSON payload:
    {
        "sender": "email@example.com" (optional, fallback to DEFAULT_EMAIL_SENDER),
        "recipients": ["email1@example.com", "email2@example.com"],
        "cc": ["cc@example.com"] (optional),
        "subject": "Email Subject",
        "body": "Email body content"
    }
    """
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        if not data.get('recipients'):
            return JsonResponse(
                {'error': 'recipients field is required'},
                status=400
            )
        
        if not data.get('subject'):
            return JsonResponse(
                {'error': 'subject field is required'},
                status=400
            )
        
        if not data.get('body'):
            return JsonResponse(
                {'error': 'body field is required'},
                status=400
            )
        
        # Validate recipients is a list
        recipients = data.get('recipients', [])
        if not isinstance(recipients, list) or len(recipients) == 0:
            return JsonResponse(
                {'error': 'recipients must be a non-empty list'},
                status=400
            )
        
        # Get sender with fallback to default
        sender = data.get('sender')
        default_sender = os.getenv('DEFAULT_EMAIL_SENDER', settings.DEFAULT_FROM_EMAIL)
        final_sender = sender if sender else default_sender
        
        # Get CC with fallback
        cc = data.get('cc')
        if not cc:
            default_cc_env = os.getenv('DEFAULT_CC_EMAILS', '')
            cc = [email.strip() for email in default_cc_env.split(',') if email.strip()]
        
        subject = data.get('subject', '').strip()
        body = data.get('body', '').strip()
        
        # Create EmailLog record
        email_log = EmailLog.objects.create(
            sender=final_sender,
            recipients=recipients,
            cc=cc,
            subject=subject,
            body=body,
            status='pending'
        )
        
        # Send to Celery task
        task = send_bulk_emails.delay(
            email_log_id=email_log.id,
            sender=final_sender,
            recipients=recipients,
            cc=cc,
            subject=subject,
            body=body
        )
        
        # Store task ID for tracking
        email_log.task_id = task.id
        email_log.save()
        
        logger.info(f"Email task created: {task.id} for log {email_log.id}")
        
        return JsonResponse({
            'success': True,
            'message': 'Email queued for sending',
            'task_id': task.id,
            'log_id': email_log.id
        }, status=202)
        
    except json.JSONDecodeError:
        return JsonResponse(
            {'error': 'Invalid JSON payload'},
            status=400
        )
    except Exception as e:
        logger.error(f"Error in send_email: {str(e)}")
        return JsonResponse(
            {'error': f'Internal server error: {str(e)}'},
            status=500
        )


@csrf_exempt
@require_http_methods(["GET"])
def email_status(request, task_id):
    """
    Check the status of an email sending task
    
    Args:
        task_id: Celery task ID
    """
    try:
        from celery.result import AsyncResult
        
        task_result = AsyncResult(task_id)
        
        # Also try to get from database for more details
        email_log = EmailLog.objects.filter(task_id=task_id).first()
        
        return JsonResponse({
            'task_id': task_id,
            'status': task_result.state,
            'log_status': email_log.status if email_log else None,
            'error_message': email_log.error_message if email_log else None,
        })
        
    except Exception as e:
        logger.error(f"Error checking task status: {str(e)}")
        return JsonResponse(
            {'error': f'Error checking status: {str(e)}'},
            status=500
        )

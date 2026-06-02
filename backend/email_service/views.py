import json
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import os
from .models import EmailLog
from .tasks import send_bulk_emails
from .utils import parse_csv_file, parse_excel_file

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def send_email(request):
    """
    API endpoint to send bulk emails with optional CSV data for personalization
    
    Expected JSON payload:
    {
        "sender": "email@example.com" (optional, fallback to DEFAULT_EMAIL_SENDER),
        "recipients": ["email1@example.com", "email2@example.com"],
        "cc": ["cc@example.com"] (optional),
        "subject": "Email Subject",
        "body": "Email body content with {column_name} placeholders",
        "csv_data": [
            {"name": "John", "email": "john@example.com"},
            {"name": "Jane", "email": "jane@example.com"}
        ] (optional for personalization)
    }
    
    If csv_data is provided:
    - recipients should contain email column names like "email" or can be omitted
    - body can contain {column_name} placeholders that will be replaced with actual values
    - Each row in csv_data will receive a personalized email
    """
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        if not data.get('recipients') and not data.get('csv_data'):
            return JsonResponse(
                {'error': 'Either recipients list or csv_data is required'},
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
        recipients = data.get('recipients', [])
        csv_data = data.get('csv_data')
        
        # Validate recipients
        if not csv_data:
            if not isinstance(recipients, list) or len(recipients) == 0:
                return JsonResponse(
                    {'error': 'recipients must be a non-empty list'},
                    status=400
                )
        
        # Create EmailLog record
        email_log = EmailLog.objects.create(
            sender=final_sender,
            recipients=recipients,
            cc=cc,
            subject=subject,
            body=body,
            csv_data=csv_data,  # Store CSV data for personalization
            status='pending'
        )
        
        # Send to Celery task
        task = send_bulk_emails.delay(
            email_log_id=email_log.id,
            sender=final_sender,
            recipients=recipients,
            cc=cc,
            subject=subject,
            body=body,
            csv_data=csv_data
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


@csrf_exempt
@require_http_methods(["POST"])
def upload_csv_file(request):
    """
    Upload and parse CSV or Excel file
    
    Expected: multipart/form-data with 'file' field containing .csv or .xlsx file
    
    Returns:
    {
        "success": true,
        "columns": ["name", "email", "phone"],
        "data": [
            {"name": "John", "email": "john@example.com", "phone": "123-456-7890"},
            ...
        ],
        "row_count": 100
    }
    """
    try:
        if 'file' not in request.FILES:
            return JsonResponse(
                {'error': 'No file provided'},
                status=400
            )
        
        uploaded_file = request.FILES['file']
        file_name = uploaded_file.name.lower()
        
        # Read file content
        file_content = uploaded_file.read()
        
        # Parse based on file type
        if file_name.endswith('.csv'):
            rows, columns = parse_csv_file(file_content)
        elif file_name.endswith('.xlsx') or file_name.endswith('.xls'):
            rows, columns = parse_excel_file(file_content)
        else:
            return JsonResponse(
                {'error': 'Unsupported file format. Please upload .csv or .xlsx file'},
                status=400
            )
        
        logger.info(f"Successfully parsed file {file_name} with {len(rows)} rows and columns: {columns}")
        
        return JsonResponse({
            'success': True,
            'columns': columns,
            'data': rows,
            'row_count': len(rows)
        })
        
    except ValueError as e:
        logger.error(f"Validation error in upload_csv_file: {str(e)}")
        return JsonResponse(
            {'error': str(e)},
            status=400
        )
    except Exception as e:
        logger.error(f"Error uploading CSV file: {str(e)}")
        return JsonResponse(
            {'error': f'Error processing file: {str(e)}'},
            status=500
        )

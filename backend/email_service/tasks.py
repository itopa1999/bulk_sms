import os
import logging
from celery import shared_task
from django.core.mail import send_mass_mail
from django.conf import settings
from .models import EmailLog

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_bulk_emails(self, email_log_id, sender, recipients, cc, subject, body):
    """
    Celery task to send bulk emails asynchronously
    
    Args:
        email_log_id: ID of the EmailLog record
        sender: Email address of sender (can be None)
        recipients: List of recipient emails
        cc: List of CC emails (can be None)
        subject: Email subject
        body: Email body
    """
    try:
        # Get email log entry
        email_log = EmailLog.objects.get(id=email_log_id)
        
        # Use fallback defaults if sender or cc are None/empty
        default_sender = os.getenv('DEFAULT_EMAIL_SENDER', settings.DEFAULT_FROM_EMAIL)
        final_sender = sender if sender else default_sender
        final_cc = cc if cc else os.getenv('DEFAULT_CC_EMAILS', '').split(',') if os.getenv('DEFAULT_CC_EMAILS') else []
        # Clean up empty strings in cc list
        final_cc = [email.strip() for email in final_cc if email.strip()]
        
        # Prepare email messages
        message_list = []
        for recipient in recipients:
            message = (
                subject,
                body,
                final_sender,
                [recipient.strip()] + final_cc  # Add CC to each email
            )
            message_list.append(message)
        
        # Send emails
        if message_list:
            send_mass_mail(message_list, fail_silently=False)
            email_log.status = 'sent'
            email_log.error_message = None
            logger.info(f"Successfully sent emails for log {email_log_id}")
        else:
            raise ValueError("No valid recipients found")
            
    except Exception as exc:
        logger.error(f"Error sending emails for log {email_log_id}: {str(exc)}")
        email_log.status = 'failed'
        email_log.error_message = str(exc)
        
        # Retry with exponential backoff
        try:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)
        except self.MaxRetriesExceededError:
            logger.error(f"Max retries exceeded for email log {email_log_id}")
            email_log.error_message = f"Failed after {self.max_retries} retries: {str(exc)}"
    
    finally:
        email_log.save()

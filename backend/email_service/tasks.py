import os
import logging
from celery import shared_task
from django.core.mail import send_mass_mail
from django.conf import settings
from .models import EmailLog
from .utils import replace_template_variables

logger = logging.getLogger(__name__)


def has_invalid_header_value(value):
    """Email headers cannot contain raw newlines."""
    return '\n' in value or '\r' in value


@shared_task(bind=True, max_retries=3)
def send_bulk_emails(self, email_log_id, sender, recipients, cc, subject, body, csv_data=None):
    """
    Celery task to send bulk emails asynchronously with optional CSV data for personalization
    
    Args:
        email_log_id: ID of the EmailLog record
        sender: Email address of sender (can be None)
        recipients: List of recipient emails or column names (can be empty if csv_data provided)
        cc: List of CC emails (can be None)
        subject: Email subject (can contain {column_name} placeholders)
        body: Email body (can contain {column_name} placeholders)
        csv_data: List of dicts with row data for personalization (optional)
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
        skipped_messages = []
        
        # Check if we have CSV data for personalization
        if csv_data:
            # Personalized emails from CSV data
            for row_data in csv_data:
                # Replace template variables in subject and body
                personalized_subject = replace_template_variables(subject, row_data)
                personalized_body = replace_template_variables(body, row_data)
                
                # Determine recipient email from row data
                # Look for common email column names
                recipient_email = None
                for email_col in ['email', 'Email', 'EMAIL', 'e-mail', 'E-Mail', 'recipient']:
                    if email_col in row_data:
                        recipient_email = row_data[email_col].strip()
                        break
                
                # If no email column found, try the first recipient from the recipients list
                if not recipient_email and recipients and len(recipients) > 0:
                    recipient_email = recipients[0]
                
                # Skip if no valid recipient email
                if not recipient_email or '@' not in recipient_email:
                    skip_reason = f"Skipping row due to missing email: {row_data}"
                    skipped_messages.append(skip_reason)
                    logger.warning(skip_reason)
                    continue

                if has_invalid_header_value(personalized_subject):
                    skip_reason = (
                        f"Skipping {recipient_email} because personalized subject "
                        "contains newline characters"
                    )
                    skipped_messages.append(skip_reason)
                    logger.warning("%s: %r", skip_reason, personalized_subject)
                    continue
                
                message = (
                    personalized_subject,
                    personalized_body,
                    final_sender,
                    [recipient_email] + final_cc  # Add CC to each email
                )
                message_list.append(message)
        else:
            # Standard emails to all recipients (no personalization)
            for recipient in recipients:
                if has_invalid_header_value(subject):
                    skip_reason = (
                        f"Skipping {recipient} because subject contains newline characters"
                    )
                    skipped_messages.append(skip_reason)
                    logger.warning("%s: %r", skip_reason, subject)
                    continue

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
            email_log.error_message = '\n'.join(skipped_messages) if skipped_messages else None
            logger.info(f"Successfully sent {len(message_list)} emails for log {email_log_id}")
        else:
            if skipped_messages:
                raise ValueError("No valid emails to send. " + " ".join(skipped_messages))
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


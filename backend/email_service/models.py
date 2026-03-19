from django.db import models


class EmailLog(models.Model):
    """Log for tracking email sending status"""
    sender = models.EmailField()
    recipients = models.JSONField()  # List of recipient emails
    cc = models.JSONField(null=True, blank=True)  # List of CC emails
    subject = models.CharField(max_length=500)
    body = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('sent', 'Sent'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    task_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.subject} - {self.status}"

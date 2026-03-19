from django.urls import path
from . import views

app_name = 'email_service'

urlpatterns = [
    path('send/', views.send_email, name='send_email'),
    path('status/<str:task_id>/', views.email_status, name='email_status'),
]

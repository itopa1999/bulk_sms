from django.http import JsonResponse,HttpResponse
from django.shortcuts import render, redirect
from django.contrib import messages
import requests

def index(request):
    
    return render(request,'index.html')


def send_messages(request):
    if request.method == 'POST':
        phone_no = request.POST.get('phone')
        url = "https://api.ng.termii.com/api/sms/send/bulk"
        payload = {
                "to": ["2348064160380"],
                "from": "fastBeep",
                "sms": "Hi there, testing Termii ",
                "type": "plain",
                "channel": "generic",
                "api_key": "TLslRdqb6P0e2afNMaNb0wnUFHBqbEYl1T6em3KEHGcH5fLEcmLGohXPQkHj1c",
            }
        headers = {
        'Content-Type': 'application/json',
        }
        response = requests.request("POST", url, headers=headers, json=payload)
        print(response.text)
        
        return redirect('index')
        
    pass
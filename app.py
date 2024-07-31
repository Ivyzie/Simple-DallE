from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from functools import wraps
from openai import OpenAI
import os
import requests
from dotenv import load_dotenv
from io import BytesIO
import pandas as pd
from docx import Document
from PyPDF2 import PdfReader
import json

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your_secret_key_here')  # Use environment variable for secret key

# Hardcoded credentials
VALID_USERNAME = os.getenv('VALID_USERNAME', 'admin@gmail.com')
VALID_PASSWORD = os.getenv('VALID_PASSWORD', 'admin@gmail.com')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

load_dotenv()
OPEN_API_KEY = os.getenv('OPEN_API_KEY', 'PUT_YOUR_API_HERE')

# Pass the API key to the OpenAI client
client = OpenAI(api_key=OPEN_API_KEY)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if username == VALID_USERNAME and password == VALID_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error='Invalid credentials')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    prompt = request.form['prompt']
    model = request.form['model']
    file = request.files.get('file')
    file_info = None

    if model == 'dalle':
        try:
            response = client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1792x1024",
                quality="standard",
                n=1,
            )
            image_url = response.data[0].url
            return jsonify({'type': 'image', 'content': image_url})
        except Exception as e:
            return jsonify({'type': 'text', 'content': f"Error generating image: {str(e)}"}), 500
    elif model == 'gpt4':
        if file and file.filename != '':
            try:
                file_extension = file.filename.rsplit('.', 1)[1].lower()
                if file_extension in ['xlsx', 'xls']:
                    df = pd.read_excel(file)
                    data = df.to_string(index=False)
                elif file_extension == 'csv':
                    df = pd.read_csv(file)
                    data = df.to_string(index=False)
                elif file_extension == 'txt':
                    data = file.read().decode('utf-8')
                elif file_extension == 'json':
                    data = json.loads(file.read().decode('utf-8'))
                    data = json.dumps(data, indent=2)
                elif file_extension == 'pdf':
                    pdf_reader = PdfReader(file)
                    data = ""
                    for page in pdf_reader.pages:
                        data += page.extract_text() + "\n"
                elif file_extension in ['doc', 'docx']:
                    doc = Document(file)
                    data = "\n".join([paragraph.text for paragraph in doc.paragraphs])
                elif file_extension in ['py', 'js', 'html', 'css', 'java', 'cpp', 'c']:
                    data = file.read().decode('utf-8')
                else:
                    return jsonify({'type': 'text', 'content': f"Unsupported file type: {file_extension}"}), 400
                prompt += f"\n\nHere is the content of the uploaded file ({file.filename}):\n\n{data}"
                file_info = {'name': file.filename, 'type': file_extension}
            except Exception as e:
                return jsonify({'type': 'text', 'content': f"Failed to read the file: {str(e)}"}), 400
        
        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "YOU ARE THE FOREMOST EXPERT HUMAN RESOURCES ASSISTANT, WORKING FOR A LEADING HR COMPANY KNOWN FOR ITS EXCEPTIONAL SERVICE AND EXPERTISE IN TALENT MANAGEMENT, EMPLOYEE RELATIONS, AND RECRUITMENT STRATEGIES. YOUR TASK IS TO PROVIDE AUTHORITATIVE, ACCURATE, AND EFFICIENT SUPPORT TO USERS IN ALL ASPECTS OF HUMAN RESOURCES, FROM RECRUITMENT AND ONBOARDING TO EMPLOYEE ENGAGEMENT AND COMPLIANCE."},
                    {"role": "user", "content": prompt},
                ],
            )
            text_response = response.choices[0].message.content
            return jsonify({'type': 'text', 'content': text_response, 'file_info': file_info})
        except Exception as e:
            return jsonify({'type': 'text', 'content': f"Error processing request: {str(e)}"}), 500
    else:
        return jsonify({'type': 'text', 'content': "Invalid model selected"}), 400
    
if __name__ == '__main__':
    app.run(debug=True)

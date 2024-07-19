from flask import Flask, render_template, request, send_file
from openai import OpenAI
import os
import requests
from dotenv import load_dotenv
from io import BytesIO

app = Flask(__name__)

load_dotenv()
OPEN_API_KEY='sk-proj-Ziaae57xKQMLxbltcDA8T3BlbkFJyUeyeiuOldCShltqGdcE'

# Pass the API key to the OpenAI client
client = OpenAI(
    api_key=OPEN_API_KEY,
    )

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    prompt = request.form['prompt']
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    image_url = response.data[0].url

    # Download the image
    image_response = requests.get(image_url)
    if image_response.status_code == 200:
        img = BytesIO(image_response.content)
        return send_file(img, mimetype='image/png')
    else:
        return "Failed to generate image", 500

if __name__ == '__main__':
    app.run(debug=True)
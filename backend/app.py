from flask import Flask, request, jsonify
from dotenv import load_dotenv
from flask_cors import CORS



load_dotenv()

app = Flask(__name__)

CORS(app, supports_credentials=True)





if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000,debug=True)
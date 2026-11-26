from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from pathlib import Path
from datetime import timedelta
import os

from routes.auth import auth_bp
from routes.journals import journals_bp
from routes.mood import mood_bp
from routes.checkins import checkins_bp


# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


# Initialize Flask application
app = Flask(__name__)

# Security: Maximum request size (5 MB)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


# JWT configuration
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=30)

if not app.config["JWT_SECRET_KEY"]:
    raise RuntimeError("JWT_SECRET_KEY is missing from backend/.env")


# CORS security configuration
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGIN",
        "http://127.0.0.1:5500"
    ).split(",")
]

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins
        }
    }
)


# Initialize JWT
jwt = JWTManager(app)


# Register API routes
app.register_blueprint(auth_bp)
app.register_blueprint(journals_bp)
app.register_blueprint(mood_bp)
app.register_blueprint(checkins_bp)


# Home route
@app.route("/")
def home():
    return jsonify({
        "message": "Welcome to MoodPrint Backend!",
        "status": "Running successfully"
    })


# Health check route
@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy",
        "project": "MoodPrint"
    })


# Run application
if __name__ == "__main__":
    app.run(debug=True, port=5000)
from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
from database.db import get_db_connection
import mysql.connector
import re

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

bcrypt = Bcrypt()


# ==================================
# USER REGISTRATION
# ==================================

@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    login_key = data.get("login_key", "")
    salt = data.get("salt", "")

    if not all([username, email, login_key, salt]):
        return jsonify({"error": "All fields are required"}), 400

    if len(username) > 100 or len(email) > 150:
        return jsonify({"error": "Username or email is too long"}), 400

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"error": "Invalid email address"}), 400

    if len(salt) > 128:
        return jsonify({"error": "Invalid salt"}), 400

    hashed_key = bcrypt.generate_password_hash(
        login_key
    ).decode("utf-8")

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        query = """
            INSERT INTO users
            (username, email, login_key_hash, salt)
            VALUES (%s, %s, %s, %s)
        """

        cursor.execute(
            query,
            (username, email, hashed_key, salt)
        )

        connection.commit()

        return jsonify({
            "message": "Registration successful",
            "status": "success"
        }), 201

    except mysql.connector.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Registration failed"}), 500

    finally:
        if cursor:
            cursor.close()

        connection.close()


# ==================================
# USER LOGIN
# ==================================

@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    login_key = data.get("login_key", "")

    if not email or not login_key:
        return jsonify({
            "error": "Email and login key are required"
        }), 400

    connection = get_db_connection()

    if connection is None:
        return jsonify({
            "error": "Database connection failed"
        }), 500

    cursor = None

    try:
        cursor = connection.cursor()

        query = """
            SELECT id, username, login_key_hash
            FROM users
            WHERE email = %s
        """

        cursor.execute(query, (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({
                "error": "Invalid email or login key"
            }), 401

        user_id, username, stored_hash = user

        if not bcrypt.check_password_hash(
            stored_hash, login_key
        ):
            return jsonify({
                "error": "Invalid email or login key"
            }), 401

        access_token = create_access_token(
            identity=str(user_id)
        )

        return jsonify({
            "message": "Login successful",
            "username": username,
            "access_token": access_token
        }), 200

    except mysql.connector.Error:
        return jsonify({
            "error": "Login failed"
        }), 500

    finally:
        if cursor:
            cursor.close()

        connection.close()
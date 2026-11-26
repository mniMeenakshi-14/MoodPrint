from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from database.db import get_db_connection
import mysql.connector
import json
import re

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

bcrypt = Bcrypt()


def public_user(row):
    return {
        "id": row[0],
        "username": row[1],
        "name": row[2],
        "role": row[3],
        "profile": row[4] if row[4] else {}
    }


# ==========================================
# 1. LOOK UP ACCOUNT BY USERNAME
# ==========================================

@auth_bp.route("/accounts/by-username/<username>", methods=["GET"])
def lookup_account(username):

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, salt, iterations
            FROM users
            WHERE username = %s
        """, (username.strip(),))

        user = cursor.fetchone()

        if not user:
            return jsonify({
                "exists": False
            }), 200

        if not user[1] or not user[2]:
            return jsonify({
                "error": "Account requires authentication setup"
            }), 409

        return jsonify({
            "exists": True,
            "id": user[0],
            "salt": user[1],
            "iterations": user[2]
        }), 200

    except mysql.connector.Error:
        return jsonify({"error": "Account lookup failed"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# ==========================================
# 2. REGISTER ACCOUNT
# ==========================================

@auth_bp.route("/accounts", methods=["POST"])
def register():

    data = request.get_json(silent=True) or {}

    username = data.get("username", "").strip()
    name = data.get("name", "").strip()
    role = data.get("role", "").strip().lower()
    salt = data.get("salt", "")
    iterations = data.get("iterations")
    verifier = data.get("login_verifier", "")
    profile = data.get("profile") or {}

    if not all([username, name, role, salt, iterations, verifier]):
        return jsonify({"error": "Required fields are missing"}), 400

    if role != "student":
        return jsonify({
            "error": "Counsellor accounts require verification"
        }), 403

    if len(username) > 100 or len(name) > 100:
        return jsonify({"error": "Username or name is too long"}), 400

    if not isinstance(profile, dict):
        return jsonify({"error": "Invalid profile"}), 400

    if not isinstance(iterations, int) or iterations < 100000 or iterations > 1000000:
        return jsonify({"error": "Invalid PBKDF2 iterations"}), 400

    if len(salt) > 128 or not re.fullmatch(r"[A-Za-z0-9+/]+={0,2}", salt):
        return jsonify({"error": "Invalid salt"}), 400

    if not isinstance(verifier, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", verifier):
        return jsonify({"error": "Invalid login verifier"}), 400

    hashed_verifier = bcrypt.generate_password_hash(
        verifier
    ).decode("utf-8")

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO users
            (username, name, role, profile, salt, iterations,
             login_verifier_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            username,
            name,
            role,
            json.dumps(profile),
            salt,
            iterations,
            hashed_verifier
        ))

        connection.commit()

        user_id = cursor.lastrowid

        token = create_access_token(identity=str(user_id))

        return jsonify({
            "message": "Registration successful",
            "token": token,
            "user": {
                "id": user_id,
                "username": username,
                "name": name,
                "role": role,
                "profile": profile
            }
        }), 201

    except mysql.connector.IntegrityError:
        connection.rollback()
        return jsonify({"error": "Username already exists"}), 409

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Registration failed"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# ==========================================
# 3. LOGIN ACCOUNT
# ==========================================

@auth_bp.route("/accounts/<int:user_id>/login", methods=["POST"])
def login(user_id):

    data = request.get_json(silent=True) or {}
    verifier = data.get("login_verifier", "")

    if not isinstance(verifier, str) or not verifier:
        return jsonify({"error": "Login verifier is required"}), 400

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, username, name, role, profile,
                   login_verifier_hash
            FROM users
            WHERE id = %s
        """, (user_id,))

        row = cursor.fetchone()

        if not row or not row[5]:
            return jsonify({"error": "Invalid login credentials"}), 401

        if not bcrypt.check_password_hash(row[5], verifier):
            return jsonify({"error": "Invalid login credentials"}), 401

        profile = row[4]

        if isinstance(profile, str):
            profile = json.loads(profile)

        user = public_user((row[0], row[1], row[2], row[3], profile))

        token = create_access_token(identity=str(row[0]))

        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": user
        }), 200

    except mysql.connector.Error:
        return jsonify({"error": "Login failed"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# ==========================================
# 4. GET CURRENT USER
# ==========================================

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():

    user_id = get_jwt_identity()

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id, username, name, role, profile
            FROM users
            WHERE id = %s
        """, (user_id,))

        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "User not found"}), 404

        profile = row[4]

        if isinstance(profile, str):
            profile = json.loads(profile)

        return jsonify({
            "user": public_user(
                (row[0], row[1], row[2], row[3], profile)
            )
        }), 200

    except mysql.connector.Error:
        return jsonify({"error": "Unable to retrieve user"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# ==========================================
# 5. UPDATE CURRENT USER PROFILE
# ==========================================

@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_current_user():

    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    # Only allow name and profile updates
    if not data or not set(data.keys()).issubset({"name", "profile"}):
        return jsonify({"error": "Invalid update fields"}), 400

    if "name" in data:
        name = data["name"]

        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
            return jsonify({"error": "Invalid name"}), 400

    if "profile" in data:
        profile = data["profile"]

        if not isinstance(profile, dict):
            return jsonify({"error": "Profile must be a JSON object"}), 400

        if len(json.dumps(profile)) > 10000:
            return jsonify({"error": "Profile is too large"}), 400

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, username, name, role, profile
            FROM users
            WHERE id = %s
        """, (user_id,))

        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        current_profile = user["profile"]

        if isinstance(current_profile, str):
            current_profile = json.loads(current_profile)

        current_profile = current_profile or {}

        new_name = data.get("name", user["name"])
        new_profile = data.get("profile", current_profile)

        cursor.execute("""
            UPDATE users
            SET name = %s, profile = %s
            WHERE id = %s
        """, (
            new_name.strip() if isinstance(new_name, str) else new_name,
            json.dumps(new_profile),
            user_id
        ))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Profile updated successfully",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "name": new_name.strip() if isinstance(new_name, str) else new_name,
                "role": user["role"],
                "profile": new_profile
            }
        }), 200

    except (mysql.connector.Error, ValueError):
        connection.rollback()
        return jsonify({"error": "Unable to update profile"}), 500

    finally:
        if cursor:
            cursor.close()

        connection.close()
import base64
import binascii

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from database.db import get_db_connection
import mysql.connector


mood_bp = Blueprint(
    "mood",
    __name__,
    url_prefix="/api/mood"
)


# Maximum encrypted mood data: 1 MB
MAX_ENCRYPTED_SIZE = 1024 * 1024


def validate_encrypted_data(encrypted_content, iv):
    """
    Validate Base64 ciphertext and AES-GCM IV.

    The frontend must encrypt mood information before sending it.
    The backend never receives the Vault Key or plaintext mood data.
    """

    if not isinstance(encrypted_content, str) or not encrypted_content:
        return False

    if not isinstance(iv, str) or not iv:
        return False

    if len(encrypted_content) > 2 * MAX_ENCRYPTED_SIZE:
        return False

    try:
        ciphertext = base64.b64decode(
            encrypted_content,
            validate=True
        )

        decoded_iv = base64.b64decode(
            iv,
            validate=True
        )

    except (binascii.Error, ValueError):
        return False

    # AES-GCM ciphertext includes a 16-byte authentication tag.
    if len(ciphertext) < 16:
        return False

    # Web Crypto AES-GCM uses a 12-byte IV.
    if len(decoded_iv) != 12:
        return False

    if len(ciphertext) > MAX_ENCRYPTED_SIZE:
        return False

    return True


# 1. SAVE ENCRYPTED MOOD ANALYSIS
@mood_bp.route("/save", methods=["POST"])
@jwt_required()
def save_mood():

    data = request.get_json(silent=True) or {}

    journal_id = data.get("journal_id")
    encrypted_content = data.get("encrypted_content")
    iv = data.get("iv")

    if not isinstance(journal_id, str) or not (
        0 < len(journal_id) <= 100
    ):
        return jsonify({
            "error": "Invalid or missing journal_id"
        }), 400

    if not validate_encrypted_data(encrypted_content, iv):
        return jsonify({
            "error": "Invalid encrypted mood data or IV"
        }), 400

    user_id = get_jwt_identity()

    connection = get_db_connection()

    if connection is None:
        return jsonify({
            "error": "Database connection failed"
        }), 500

    cursor = None

    try:
        cursor = connection.cursor()

        # Confirm that the journal belongs to the logged-in user.
        cursor.execute("""
            SELECT journal_id
            FROM journals
            WHERE journal_id = %s AND user_id = %s
        """, (journal_id, user_id))

        if cursor.fetchone() is None:
            return jsonify({
                "error": "Journal not found"
            }), 404

        # Save encrypted mood information.
        # The old plaintext mood columns are explicitly set to NULL.
        cursor.execute("""
            INSERT INTO mood_entries
            (
                user_id,
                journal_id,
                mood_label,
                mood_score,
                encrypted_content,
                iv
            )
            VALUES (%s, %s, NULL, NULL, %s, %s)

            ON DUPLICATE KEY UPDATE
                encrypted_content = VALUES(encrypted_content),
                iv = VALUES(iv),
                mood_label = NULL,
                mood_score = NULL,
                analyzed_at = CURRENT_TIMESTAMP
        """, (
            user_id,
            journal_id,
            encrypted_content,
            iv
        ))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Encrypted mood analysis saved successfully"
        }), 201

    except mysql.connector.Error:
        connection.rollback()

        return jsonify({
            "error": "Failed to save encrypted mood analysis"
        }), 500

    finally:
        if cursor:
            cursor.close()

        connection.close()


# 2. GET ENCRYPTED MOOD HISTORY
@mood_bp.route("/history", methods=["GET"])
@jwt_required()
def get_mood_history():

    user_id = get_jwt_identity()

    connection = get_db_connection()

    if connection is None:
        return jsonify({
            "error": "Database connection failed"
        }), 500

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        # Return encrypted information only.
        cursor.execute("""
            SELECT
                journal_id,
                encrypted_content,
                iv,
                analyzed_at
            FROM mood_entries
            WHERE user_id = %s
              AND encrypted_content IS NOT NULL
              AND iv IS NOT NULL
            ORDER BY analyzed_at DESC
        """, (user_id,))

        moods = cursor.fetchall()

        return jsonify({
            "status": "success",
            "mood_history": moods
        }), 200

    except mysql.connector.Error:
        return jsonify({
            "error": "Failed to retrieve encrypted mood history"
        }), 500

    finally:
        if cursor:
            cursor.close()

        connection.close()
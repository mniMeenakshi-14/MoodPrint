from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.db import get_db_connection
import mysql.connector

mood_bp = Blueprint(
    "mood",
    __name__,
    url_prefix="/api/mood"
)


# 1. SAVE MOOD ANALYSIS
@mood_bp.route("/save", methods=["POST"])
@jwt_required()
def save_mood():

    data = request.get_json(silent=True) or {}

    journal_id = data.get("journal_id")
    mood_label = data.get("mood_label")
    mood_score = data.get("mood_score")

    if not all([journal_id, mood_label]) or mood_score is None:
        return jsonify({
            "error": "journal_id, mood_label and mood_score are required"
        }), 400

    if not isinstance(mood_label, str) or not mood_label.strip():
        return jsonify({"error": "Invalid mood label"}), 400

    try:
        mood_score = float(mood_score)

        if not 0 <= mood_score <= 100:
            return jsonify({
                "error": "Mood score must be between 0 and 100"
            }), 400

    except (ValueError, TypeError):
        return jsonify({"error": "Mood score must be a number"}), 400

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        # Check that the journal belongs to this user
        cursor.execute("""
            SELECT journal_id
            FROM journals
            WHERE journal_id = %s AND user_id = %s
        """, (journal_id, user_id))

        if cursor.fetchone() is None:
            return jsonify({
                "error": "Journal not found"
            }), 404

        # Insert or update mood analysis
        cursor.execute("""
            INSERT INTO mood_entries
            (user_id, journal_id, mood_label, mood_score)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            mood_label = VALUES(mood_label),
            mood_score = VALUES(mood_score),
            analyzed_at = CURRENT_TIMESTAMP
        """, (user_id, journal_id, mood_label.strip(), mood_score))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Mood analysis saved successfully"
        }), 201

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({
            "error": "Failed to save mood analysis"
        }), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 2. GET MOOD HISTORY
@mood_bp.route("/history", methods=["GET"])
@jwt_required()
def get_mood_history():

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT journal_id, mood_label, mood_score, analyzed_at
            FROM mood_entries
            WHERE user_id = %s
            ORDER BY analyzed_at DESC
        """, (user_id,))

        moods = cursor.fetchall()

        return jsonify({
            "status": "success",
            "mood_history": moods
        }), 200

    except mysql.connector.Error:
        return jsonify({
            "error": "Failed to retrieve mood history"
        }), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()
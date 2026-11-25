from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database.db import get_db_connection
import mysql.connector

journals_bp = Blueprint(
    "journals",
    __name__,
    url_prefix="/api/journals"
)


# 1. SAVE JOURNAL
@journals_bp.route("/", methods=["POST"])
@jwt_required()
def save_journal():

    data = request.get_json(silent=True) or {}

    journal_id = data.get("journal_id")
    encrypted_content = data.get("encrypted_content")
    iv = data.get("iv")

    if not all([
        isinstance(journal_id, str) and 0 < len(journal_id) <= 100,
        isinstance(encrypted_content, str) and len(encrypted_content) > 0,
        isinstance(iv, str) and 0 < len(iv) <= 255
    ]):
        return jsonify({"error": "Invalid or missing journal data"}), 400

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO journals
            (journal_id, user_id, encrypted_content, iv)
            VALUES (%s, %s, %s, %s)
        """, (journal_id, user_id, encrypted_content, iv))

        connection.commit()

        return jsonify({
            "message": "Journal saved successfully",
            "status": "success"
        }), 201

    except mysql.connector.IntegrityError:
        connection.rollback()
        return jsonify({"error": "Journal ID already exists"}), 409

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Failed to save journal"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 2. GET ALL JOURNALS
@journals_bp.route("/", methods=["GET"])
@jwt_required()
def get_journals():

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT journal_id, encrypted_content, iv,
                   created_at, updated_at
            FROM journals
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (user_id,))

        journals = cursor.fetchall()

        return jsonify({
            "status": "success",
            "journals": journals
        }), 200

    except mysql.connector.Error:
        return jsonify({"error": "Failed to retrieve journals"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 3. UPDATE JOURNAL
@journals_bp.route("/<journal_id>", methods=["PUT"])
@jwt_required()
def update_journal(journal_id):

    data = request.get_json(silent=True) or {}

    encrypted_content = data.get("encrypted_content")
    iv = data.get("iv")

    if not isinstance(encrypted_content, str) or not encrypted_content:
        return jsonify({"error": "Invalid encrypted content"}), 400

    if not isinstance(iv, str) or not 0 < len(iv) <= 255:
        return jsonify({"error": "Invalid IV"}), 400

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE journals
            SET encrypted_content = %s, iv = %s
            WHERE journal_id = %s AND user_id = %s
        """, (encrypted_content, iv, journal_id, user_id))

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "error": "Journal not found or unchanged"
            }), 404

        return jsonify({
            "message": "Journal updated successfully"
        }), 200

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Failed to update journal"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 4. DELETE JOURNAL
@journals_bp.route("/<journal_id>", methods=["DELETE"])
@jwt_required()
def delete_journal(journal_id):

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM journals
            WHERE journal_id = %s AND user_id = %s
        """, (journal_id, user_id))

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({"error": "Journal not found"}), 404

        return jsonify({
            "message": "Journal deleted successfully"
        }), 200

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Failed to delete journal"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 5. OFFLINE JOURNAL SYNCHRONIZATION
@journals_bp.route("/sync", methods=["POST"])
@jwt_required()
def sync_journals():

    data = request.get_json(silent=True) or {}
    journals = data.get("journals")

    # Validate journal list
    if not isinstance(journals, list) or not journals:
        return jsonify({
            "error": "Please provide a non-empty journals list"
        }), 400

    # Maximum 100 journals per request
    if len(journals) > 100:
        return jsonify({
            "error": "Maximum 100 journals allowed per sync request"
        }), 400

    # Validate every journal
    for journal in journals:

        if not isinstance(journal, dict):
            return jsonify({
                "error": "Invalid journal format"
            }), 400

        journal_id = journal.get("journal_id")
        encrypted_content = journal.get("encrypted_content")
        iv = journal.get("iv")

        if not all([
            isinstance(journal_id, str) and 0 < len(journal_id) <= 100,
            isinstance(encrypted_content, str) and len(encrypted_content) > 0,
            isinstance(iv, str) and 0 < len(iv) <= 255
        ]):
            return jsonify({
                "error": "Invalid journal data"
            }), 400

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()
        synced_count = 0

        for journal in journals:

            journal_id = journal["journal_id"]
            encrypted_content = journal["encrypted_content"]
            iv = journal["iv"]

            cursor.execute("""
                SELECT user_id
                FROM journals
                WHERE journal_id = %s
            """, (journal_id,))

            existing = cursor.fetchone()

            if existing:

                # Prevent another user from overwriting this journal
                if str(existing[0]) != str(user_id):
                    connection.rollback()
                    return jsonify({
                        "error": "Journal ID belongs to another user",
                        "journal_id": journal_id
                    }), 409

                # Update existing journal
                cursor.execute("""
                    UPDATE journals
                    SET encrypted_content = %s, iv = %s
                    WHERE journal_id = %s AND user_id = %s
                """, (
                    encrypted_content,
                    iv,
                    journal_id,
                    user_id
                ))

            else:

                # Insert new journal
                cursor.execute("""
                    INSERT INTO journals
                    (journal_id, user_id, encrypted_content, iv)
                    VALUES (%s, %s, %s, %s)
                """, (
                    journal_id,
                    user_id,
                    encrypted_content,
                    iv
                ))

            synced_count += 1

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Journals synchronized successfully",
            "synced_count": synced_count
        }), 200

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({
            "error": "Journal synchronization failed"
        }), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()
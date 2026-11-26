import base64
import binascii

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from database.db import get_db_connection
import mysql.connector


journals_bp = Blueprint(
    "journals",
    __name__,
    url_prefix="/api/journals"
)


MAX_ENCRYPTED_SIZE = 2 * 1024 * 1024
MAX_SYNC_COUNT = 100


def validate_encrypted_data(encrypted_content, iv):
    """Validate Base64 AES-GCM ciphertext and IV."""

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


# 1. SAVE JOURNAL
@journals_bp.route("/", methods=["POST"])
@jwt_required()
def save_journal():

    data = request.get_json(silent=True) or {}

    journal_id = data.get("journal_id")
    encrypted_content = data.get("encrypted_content")
    iv = data.get("iv")

    if not isinstance(journal_id, str) or not (
        0 < len(journal_id) <= 100
    ):
        return jsonify({"error": "Invalid journal ID"}), 400

    if not validate_encrypted_data(encrypted_content, iv):
        return jsonify({"error": "Invalid encrypted journal data or IV"}), 400

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
            "status": "success",
            "message": "Journal saved successfully"
        }), 201

    except mysql.connector.IntegrityError:
        connection.rollback()

        return jsonify({
            "error": "Journal ID already exists"
        }), 409

    except mysql.connector.Error:
        connection.rollback()

        return jsonify({
            "error": "Failed to save journal"
        }), 500

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
            SELECT
                journal_id,
                encrypted_content,
                iv,
                created_at,
                updated_at
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
        return jsonify({
            "error": "Failed to retrieve journals"
        }), 500

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

    if not validate_encrypted_data(encrypted_content, iv):
        return jsonify({"error": "Invalid encrypted journal data or IV"}), 400

    user_id = get_jwt_identity()
    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT id
            FROM journals
            WHERE journal_id = %s AND user_id = %s
        """, (journal_id, user_id))

        if cursor.fetchone() is None:
            return jsonify({"error": "Journal not found"}), 404

        cursor.execute("""
            UPDATE journals
            SET encrypted_content = %s, iv = %s
            WHERE journal_id = %s AND user_id = %s
        """, (encrypted_content, iv, journal_id, user_id))

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Journal updated successfully"
        }), 200

    except mysql.connector.Error:
        connection.rollback()

        return jsonify({
            "error": "Failed to update journal"
        }), 500

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

        if cursor.rowcount == 0:
            return jsonify({"error": "Journal not found"}), 404

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Journal deleted successfully"
        }), 200

    except mysql.connector.Error:
        connection.rollback()

        return jsonify({
            "error": "Failed to delete journal"
        }), 500

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

    if not isinstance(journals, list) or not journals:
        return jsonify({
            "error": "Please provide a non-empty journals list"
        }), 400

    if len(journals) > MAX_SYNC_COUNT:
        return jsonify({
            "error": "Maximum 100 journals allowed per sync request"
        }), 400

    seen_ids = set()

    # Validate the entire batch before accessing the database.
    for journal in journals:

        if not isinstance(journal, dict):
            return jsonify({"error": "Invalid journal format"}), 400

        journal_id = journal.get("journal_id")
        encrypted_content = journal.get("encrypted_content")
        iv = journal.get("iv")

        if not isinstance(journal_id, str) or not (
            0 < len(journal_id) <= 100
        ):
            return jsonify({"error": "Invalid journal ID"}), 400

        if journal_id in seen_ids:
            return jsonify({
                "error": "Duplicate journal ID in sync request",
                "journal_id": journal_id
            }), 400

        seen_ids.add(journal_id)

        if not validate_encrypted_data(encrypted_content, iv):
            return jsonify({
                "error": "Invalid encrypted journal data or IV",
                "journal_id": journal_id
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

            cursor.execute("""
                SELECT user_id
                FROM journals
                WHERE journal_id = %s
            """, (journal_id,))

            existing = cursor.fetchone()

            if existing:

                # Do not allow one user to overwrite another user's journal.
                if str(existing[0]) != str(user_id):
                    connection.rollback()

                    return jsonify({
                        "error": "Journal ID belongs to another user",
                        "journal_id": journal_id
                    }), 409

                cursor.execute("""
                    UPDATE journals
                    SET encrypted_content = %s, iv = %s
                    WHERE journal_id = %s AND user_id = %s
                """, (
                    journal["encrypted_content"],
                    journal["iv"],
                    journal_id,
                    user_id
                ))

            else:

                cursor.execute("""
                    INSERT INTO journals
                    (journal_id, user_id, encrypted_content, iv)
                    VALUES (%s, %s, %s, %s)
                """, (
                    journal_id,
                    user_id,
                    journal["encrypted_content"],
                    journal["iv"]
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
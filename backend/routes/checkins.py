import base64
import binascii
import uuid
import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from database.db import get_db_connection
import mysql.connector


checkins_bp = Blueprint(
    "checkins",
    __name__,
    url_prefix="/api/checkins"
)

MAX_ENCRYPTED_SIZE = 1024 * 1024


def validate_encrypted_data(encrypted_content, iv):

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

    return (
        len(ciphertext) >= 16
        and len(ciphertext) <= MAX_ENCRYPTED_SIZE
        and len(decoded_iv) == 12
    )


# 1. SAVE DAILY CHECK-IN
@checkins_bp.route("/", methods=["POST"])
@jwt_required()
def save_checkin():

    data = request.get_json(silent=True) or {}

    checkin_day = data.get("day")
    encrypted_content = data.get("encrypted_content")
    iv = data.get("iv")

    if not isinstance(checkin_day, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}", checkin_day
    ):
        return jsonify({"error": "Invalid check-in date"}), 400

    if not validate_encrypted_data(encrypted_content, iv):
        return jsonify({"error": "Invalid encrypted data or IV"}), 400

    user_id = get_jwt_identity()
    checkin_id = str(uuid.uuid4())

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            INSERT INTO checkins
            (checkin_id, user_id, checkin_day, encrypted_content, iv)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            checkin_id,
            user_id,
            checkin_day,
            encrypted_content,
            iv
        ))

        connection.commit()

        return jsonify({
            "status": "success",
            "checkin": {
                "id": checkin_id,
                "day": checkin_day,
                "encrypted_content": encrypted_content,
                "iv": iv
            }
        }), 201

    except mysql.connector.IntegrityError:
        connection.rollback()
        return jsonify({
            "error": "A check-in already exists for this date"
        }), 409

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Failed to save check-in"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 2. GET STUDENT CHECK-INS
@checkins_bp.route("/", methods=["GET"])
@jwt_required()
def get_checkins():

    user_id = get_jwt_identity()

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                checkin_id,
                checkin_day,
                encrypted_content,
                iv,
                created_at
            FROM checkins
            WHERE user_id = %s
            ORDER BY created_at ASC
        """, (user_id,))

        rows = cursor.fetchall()

        checkins = []

        for row in rows:
            checkins.append({
                "id": row["checkin_id"],
                "day": row["checkin_day"],
                "encrypted_content": row["encrypted_content"],
                "iv": row["iv"],
                "created_at": row["created_at"].isoformat()
            })

        return jsonify({
            "status": "success",
            "checkins": checkins
        }), 200

    except mysql.connector.Error:
        return jsonify({"error": "Failed to retrieve check-ins"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 3. UPDATE EXISTING CHECK-IN
@checkins_bp.route("/<checkin_id>", methods=["PUT"])
@jwt_required()
def update_checkin(checkin_id):

    data = request.get_json(silent=True) or {}

    encrypted_content = data.get("encrypted_content")
    iv = data.get("iv")

    if not validate_encrypted_data(encrypted_content, iv):
        return jsonify({"error": "Invalid encrypted data or IV"}), 400

    user_id = get_jwt_identity()

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE checkins
            SET encrypted_content = %s,
                iv = %s
            WHERE checkin_id = %s
              AND user_id = %s
        """, (
            encrypted_content,
            iv,
            checkin_id,
            user_id
        ))

        if cursor.rowcount == 0:
            connection.rollback()
            return jsonify({"error": "Check-in not found"}), 404

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Check-in updated successfully"
        }), 200

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Failed to update check-in"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# 4. DELETE CHECK-IN
@checkins_bp.route("/<checkin_id>", methods=["DELETE"])
@jwt_required()
def delete_checkin(checkin_id):

    user_id = get_jwt_identity()

    connection = get_db_connection()

    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None

    try:
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM checkins
            WHERE checkin_id = %s
              AND user_id = %s
        """, (checkin_id, user_id))

        if cursor.rowcount == 0:
            return jsonify({"error": "Check-in not found"}), 404

        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Check-in deleted successfully"
        }), 200

    except mysql.connector.Error:
        connection.rollback()
        return jsonify({"error": "Failed to delete check-in"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()
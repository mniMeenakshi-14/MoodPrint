# MoodPrint – Backend API Documentation

## 1. Project Overview

MoodPrint is a privacy-focused mood journaling application.

### Backend Technology
- Python 3.12
- Flask
- MySQL
- Flask-JWT-Extended
- Flask-Bcrypt
- Flask-CORS

### Security Architecture
- Client-side PBKDF2 key derivation.
- Client-side AES-GCM encryption.
- JWT authentication.
- Encrypted journal storage.
- Encrypted mood-analysis storage.
- Backend does not decrypt journal content.

**Important:** Genuine frontend AES-GCM integration and end-to-end encryption still need to be tested.

## 2. Base URL

Local development:

`http://127.0.0.1:5000`

Health check:

`GET /api/health`

Example response:

```json
{
    "project": "MoodPrint",
    "status": "healthy"
}
```

## 3. Authentication APIs

### 3.1 Account Lookup

- Method: GET
- Endpoint: `/api/accounts/by-username/<username>`
- Authentication: Not required.

Purpose:
Retrieve the user's account ID, salt and PBKDF2 iteration count.

Example:

`GET /api/accounts/by-username/testuser`

Success response:

```json
{
    "id": 1,
    "salt": "BASE64_ENCODED_SALT",
    "iterations": 310000
}
```

### 3.2 User Registration

- Method: POST
- Endpoint: `/api/accounts`
- Authentication: Not required.

Request body:

```json
{
    "username": "testuser",
    "name": "Test User",
    "role": "student",
    "salt": "BASE64_ENCODED_SALT",
    "iterations": 310000,
    "login_verifier": "64_CHARACTER_HEX_VERIFIER",
    "profile": {}
}
```

Supported roles:
- student
- counsellor

The frontend generates the salt and derives the login verifier.

The backend hashes the login verifier using bcrypt before storing it.

Success response: HTTP 201

```json
{
    "message": "Registration successful",
    "token": "JWT_ACCESS_TOKEN",
    "user": {
        "id": 1,
        "username": "testuser",
        "name": "Test User",
        "role": "student",
        "profile": {}
    }
}
```

### 3.3 User Login

- Method: POST
- Endpoint: `/api/accounts/<user_id>/login`
- Authentication: Not required.

The frontend first looks up the account using the username.

It then derives the login verifier using the stored salt and PBKDF2 iteration count.

Request body:

```json
{
    "login_verifier": "64_CHARACTER_HEX_VERIFIER"
}
```

Success response: HTTP 200

```json
{
    "message": "Login successful",
    "token": "JWT_ACCESS_TOKEN",
    "user": {
        "id": 1,
        "username": "testuser",
        "name": "Test User",
        "role": "student",
        "profile": {}
    }
}
```

## 4. User Profile APIs

All profile APIs require JWT authentication.

### 4.1 Get Current User

- Method: GET
- Endpoint: `/api/me`

Success response:

```json
{
    "user": {
        "id": 1,
        "username": "testuser",
        "name": "Test User",
        "role": "student",
        "profile": {}
    }
}
```

### 4.2 Update Current User

- Method: PATCH
- Endpoint: `/api/me`

Request body:

```json
{
    "name": "Updated Name",
    "profile": {
        "bio": "MoodPrint user"
    }
}
```

Only `name` and `profile` can be updated.

Username, user ID and role cannot be changed through this API.

Success response:

```json
{
    "status": "success",
    "message": "Profile updated successfully"
}
```

## 5. Journal APIs

All journal APIs require JWT authentication.

### 5.1 Save Journal

- Method: POST
- Endpoint: `/api/journals/`

Request body:

```json
{
    "journal_id": "journal_001",
    "encrypted_content": "BASE64_CIPHERTEXT",
    "iv": "BASE64_IV"
}
```

Success response:

```json
{
    "status": "success",
    "message": "Journal saved successfully"
}
```

### 5.2 Get All Journals

- Method: GET
- Endpoint: `/api/journals/`

Returns only journals belonging to the authenticated user.

### 5.3 Update Journal

- Method: PUT
- Endpoint: `/api/journals/<journal_id>`

Request body:

```json
{
    "encrypted_content": "UPDATED_BASE64_CIPHERTEXT",
    "iv": "UPDATED_BASE64_IV"
}
```

### 5.4 Delete Journal

- Method: DELETE
- Endpoint: `/api/journals/<journal_id>`

Deletes only the authenticated user's journal.

Associated mood records are deleted through the database foreign-key cascade.

## 6. Offline Synchronization API

### Synchronize Offline Journals

- Method: POST
- Endpoint: `/api/journals/sync`
- Authentication: Required.

Request body:

```json
{
    "journals": [
        {
            "journal_id": "offline_journal_001",
            "encrypted_content": "BASE64_CIPHERTEXT_1",
            "iv": "BASE64_IV_1"
        },
        {
            "journal_id": "offline_journal_002",
            "encrypted_content": "BASE64_CIPHERTEXT_2",
            "iv": "BASE64_IV_2"
        }
    ]
}
```

Features:
- Maximum 100 journals per request.
- Rejects duplicate journal IDs in the same batch.
- Validates encrypted data and IV format.
- Checks journal ownership.
- Uses database transactions.

The frontend is responsible for storing journals locally and sending pending records when connectivity returns.

## 7. Mood Analysis APIs

Mood analysis data is encrypted before being sent to the backend.

The backend stores and retrieves encrypted mood-analysis data.

### 7.1 Save Mood Analysis

- Method: POST
- Endpoint: `/api/mood/save`
- Authentication: Required.

Request body:

```json
{
    "journal_id": "journal_001",
    "encrypted_content": "BASE64_ENCRYPTED_MOOD_DATA",
    "iv": "BASE64_IV"
}
```

The encrypted mood information may contain:
- Mood label
- Mood score
- Analysis details
- Other mood-related information

The backend does not receive these plaintext values through this API.

### 7.2 Get Mood History

- Method: GET
- Endpoint: `/api/mood/history`
- Authentication: Required.

Returns the authenticated user's encrypted mood records.

Example:

```json
{
    "status": "success",
    "mood_history": [
        {
            "journal_id": "journal_001",
            "encrypted_content": "BASE64_ENCRYPTED_MOOD_DATA",
            "iv": "BASE64_IV",
            "analyzed_at": "2026-11-26T02:21:27"
        }
    ]
}
```

## 8. JWT Authentication

After successful registration or login, the backend returns a JWT access token.

Protected API requests must include:

```text
Authorization: Bearer ACCESS_TOKEN
```

Token expiration: 30 minutes.

When the token expires, the user must authenticate again.

## 9. Encryption Validation

The journal and mood APIs validate:

- Base64 ciphertext format.
- Minimum ciphertext length of 16 decoded bytes.
- AES-GCM IV length of 12 decoded bytes.
- Maximum encrypted payload size.

These checks validate data format, not the authenticity of encryption.

The actual AES-GCM encryption and decryption must happen on the client.

## 10. Database Security

### Users
Stores account information, salt, PBKDF2 iteration count and bcrypt-hashed login verifier.

### Journals
Stores:
- Journal ID
- User ID
- Encrypted journal content
- IV
- Creation and update timestamps

### Mood Entries
Stores:
- User ID
- Journal ID
- Encrypted mood content
- IV
- Analysis timestamp

Legacy columns `mood_label` and `mood_score` remain for compatibility with older records. New encrypted mood records leave them NULL.

## 11. Current Implementation Status

| Feature | Status |
|---|---|
| Registration API | Implemented |
| Login API | Implemented |
| JWT authentication | Implemented |
| Profile APIs | Implemented |
| Journal CRUD | Implemented |
| Offline sync API | Implemented |
| Encrypted mood storage API | Implemented |
| Ownership validation | Implemented |
| Database constraints | Verified |
| Real frontend encryption integration | Pending verification |
| Ollama local AI integration | Pending |
| Counsellor consent system | Pending |
| Complete offline frontend synchronization | Pending verification |

## 12. Local Development

Activate the virtual environment from the project root.

Start Flask:

```powershell
python .\backend\app.py
```

Backend address:

`http://127.0.0.1:5000`

Health check:

`http://127.0.0.1:5000/api/health`

## 13. Important Security Rules

1. Never send the original passphrase to the backend.
2. Never send the Vault Key to the backend.
3. Encrypt journal content before uploading.
4. Encrypt mood-analysis data before uploading.
5. Decrypt private information only on the user's device.
6. Never commit `.env` or authentication secrets to GitHub.
7. Use HTTPS in production.
8. Disable Flask debug mode in production.
9. Validate user ownership for every private-data operation.
10. Keep local AI processing on the user's device.
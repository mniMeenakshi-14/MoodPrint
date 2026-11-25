# MoodPrint – Backend API Documentation

## 1. Project Overview

MoodPrint is a private mood-journaling application.

The backend is developed using:
- Python
- Flask
- MySQL
- Flask-JWT-Extended
- Flask-Bcrypt

The backend stores encrypted journal content. It does not decrypt or read users' journal entries.

## 2. Base URL
text
http://127.0.0.1:5000

## 3. Authentication APIs

### 3.1 User Registration

- **Method:** POST
- **Endpoint:** `/api/auth/register`
- **Authentication:** Not required

**Request Body:**

```json
{
    "username": "TestUser",
    "email": "testuser02@example.com",
    "login_key": "CLIENT_DERIVED_LOGIN_KEY",
    "salt": "CLIENT_GENERATED_SALT"
}
```

**Success Response:** HTTP 201

```json
{
    "message": "Registration successful",
    "status": "success"
}
```

### 3.2 User Login

- **Method:** POST
- **Endpoint:** `/api/auth/login`
- **Authentication:** Not required

**Request Body:**

```json
{
    "email": "testuser02@example.com",
    "login_key": "CLIENT_DERIVED_LOGIN_KEY"
}
```

**Success Response:** HTTP 200

Returns an access token.

The frontend must use this token for protected API requests.

## 4. Journal APIs

All journal APIs require JWT authentication.

### 4.1 Save Journal

- **Method:** POST
- **Endpoint:** `/api/journals/`

**Request Body:**

```json
{
    "journal_id": "journal_001",
    "encrypted_content": "ENCRYPTED_JOURNAL_CONTENT",
    "iv": "INITIALIZATION_VECTOR"
}
```

### 4.2 Get All Journals

- **Method:** GET
- **Endpoint:** `/api/journals/`

Returns the authenticated user's saved journals.

### 4.3 Update Journal

- **Method:** PUT
- **Endpoint:** `/api/journals/<journal_id>`

**Request Body:**

```json
{
    "encrypted_content": "UPDATED_ENCRYPTED_CONTENT",
    "iv": "UPDATED_INITIALIZATION_VECTOR"
}
```

### 4.4 Delete Journal

- **Method:** DELETE
- **Endpoint:** `/api/journals/<journal_id>`

Deletes the specified journal belonging to the authenticated user.

## 5. Offline Synchronization API

### Sync Offline Journals

- **Method:** POST
- **Endpoint:** `/api/journals/sync`
- **Authentication:** Required

**Request Body:**

```json
{
    "journals": [
        {
            "journal_id": "offline_journal_001",
            "encrypted_content": "ENCRYPTED_CONTENT_001",
            "iv": "IV_VALUE_001"
        },
        {
            "journal_id": "offline_journal_002",
            "encrypted_content": "ENCRYPTED_CONTENT_002",
            "iv": "IV_VALUE_002"
        }
    ]
}
```

The frontend stores journals locally while offline and sends pending encrypted journals to this API when internet connectivity returns.

**Success Response:**

```json
{
    "message": "Journals synchronized successfully",
    "status": "success",
    "synced_count": 2
}
```

Maximum batch size: 100 journals.

## 6. Mood Analysis APIs

Mood analysis is performed on the frontend using the lexicon-based approach.

The backend only stores and retrieves the mood results.

### 6.1 Save Mood Analysis

- **Method:** POST
- **Endpoint:** `/api/mood/save`
- **Authentication:** Required

**Request Body:**

```json
{
    "journal_id": "journal_001",
    "mood_label": "Happy",
    "mood_score": 85
}
```

### 6.2 Get Mood History

- **Method:** GET
- **Endpoint:** `/api/mood/history`
- **Authentication:** Required

Returns the authenticated user's mood history.

## 7. JWT Authentication

After successful login, the backend returns a JWT access token.

For every protected API request, the frontend must include:

```text
Authorization: Bearer ACCESS_TOKEN
```

The access token expires after 30 minutes.

The frontend must obtain a new token by logging in again after expiration.

## 8. Important Security Information

1. The original passphrase must never be sent to the backend.
2. The vault key must remain on the user's device.
3. Journal content must be encrypted before being sent to the backend.
4. The backend stores encrypted journal content and IV values.
5. Mood analysis must happen on the frontend using readable journal text.
6. The `.env` file must never be shared or committed to GitHub.

## 9. Backend Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| Flask | REST API development |
| MySQL | Database |
| Flask-JWT-Extended | Authentication |
| Flask-Bcrypt | Login key hashing |
| Flask-CORS | Frontend-backend communication |
| PBKDF2 | Client-side key derivation |
| AES-GCM | Client-side journal encryption |
| IndexedDB | Frontend offline storage |

## 10. Local Development

Start the backend using:

```bash
python app.py
```

Backend address:

```text
http://127.0.0.1:5000

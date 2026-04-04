# HR Harmony Hub Backend

Production-ready backend using Node.js, Express, MongoDB Atlas (Mongoose), JWT auth, Multer upload, and Nodemailer.

## Folder Structure

- `src/config`
- `src/models`
- `src/routes`
- `src/controllers`
- `src/middleware`
- `src/services`
- `src/utils`
- `uploads`

## Setup

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start backend in dev mode:

```bash
npm run dev
```

Backend runs on `http://localhost:5000` by default.

## MongoDB Atlas

Set your Atlas connection string in `.env`:

`MONGODB_URI=mongodb+srv://...`

## Authentication

### Admin Login

`POST /api/auth/login`

Body:

```json
{
  "email": "admin@hrportal.com",
  "password": "ChangeThisStrongPassword123!"
}
```

Response contains JWT token.

Use token in protected routes:

`Authorization: Bearer <token>`

## Candidate APIs

### Public

- `POST /api/candidates/apply`
  - `multipart/form-data`
  - `resume` field required (PDF only, max 5MB)

### Admin (JWT Protected)

- `GET /api/candidates`
- `GET /api/candidates/:id`
- `GET /api/candidates/:id/resume`
- `PUT /api/candidates/:id/status`
- `PUT /api/candidates/:id/notes`
- `DELETE /api/candidates/:id`

### Enterprise Export API (JWT Protected)

- `GET /api/export/:module?format=csv|excel`
- Example:
  - `GET /api/export/candidates?format=csv`
  - `GET /api/export/candidates?format=excel`
- CSV uses `json2csv` stream transform for large datasets.
- Excel uses `exceljs` streaming workbook writer for memory-efficient generation.

## Email Notifications

Nodemailer SMTP is required:

- Application submitted email
- Status updated email

Configure:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Seed Admin

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` then run:

```bash
npm run seed:admin
```

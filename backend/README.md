# Arihant Dream Infra Project Ltd. Backend

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

## S3 File Upload

Use the S3 upload route:

- `POST /api/upload`
- Body: `multipart/form-data`
- File field: `file`
- Optional text field: `type`

Supported `type` values:

- `profile` -> uploads to `profiles/`
- `resume` -> uploads to `resumes/`
- `idcard` -> uploads to `id-cards/`
- any other value -> uploads to `documents/`

Required AWS environment variables:

- `AWS_ACCESS_KEY`
- `AWS_SECRET_KEY`
- `AWS_REGION`
- `AWS_BUCKET_NAME`

The returned URL is a public S3 object URL, so your bucket or object policy must allow public reads for uploaded files.

Examples:

- Express server example: [src/examples/s3UploadServer.example.js](./src/examples/s3UploadServer.example.js)
- Postman example: [src/examples/s3Upload.postman.md](./src/examples/s3Upload.postman.md)

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

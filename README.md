# HR Harmony Hub

Full-stack project restructured into:

```
root/
  frontend/
  backend/
  .env
  package.json
  README.md
```

## Run Locally

1. Install root dev dependency:

```bash
npm install
```

2. Install frontend dependencies:

```bash
npm install --prefix frontend
```

3. Install backend dependencies:

```bash
npm install --prefix backend
```

4. Configure backend env:

- Copy `backend/.env.example` to `backend/.env`
- Set MongoDB Atlas and SMTP credentials

5. Start both apps:

```bash
npm run dev
```

## Ports

- Frontend (Vite): `http://localhost:8080`
- Backend (Express): `http://localhost:5000`

## Notes

- Frontend proxies `/api` and `/uploads` to backend.
- Backend enables CORS for frontend origin.

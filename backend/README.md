# Warkop Backend

This is a small Express + MongoDB backend for Warkop Management System.

## Quick start (local)

1. Copy `.env.example` to `.env` and configure `MONGODB_URI` and (optional) `API_KEY`.
2. npm install
3. npm run dev

## Migrate local file to remote

If you have a `warkopData.json` exported from localStorage (or the file created by you), you can run:

```bash
npm run migrate-file -- ./warkopData.json --url=${import.meta.env.VITE_API_URL} --key=YOUR_API_KEY
```

If `API_KEY` is set in `.env`, you can omit `--key` and the script will use the env var.

## Docker

Build and run:

```bash
docker build -t warkop-backend .
docker run -e MONGODB_URI="your-mongo-uri" -e API_KEY="secret" -p 5001:5001 warkop-backend
```

## GitHub Actions (CI)

A GitHub Actions workflow is included in `.github/workflows/docker-build.yml` that builds and pushes a Docker image to GitHub Container Registry (`ghcr.io`) on push to `main`. Make sure to enable GitHub Packages and provide proper repo permissions.

## Heroku

1. Create app on Heroku
2. Set config vars `MONGODB_URI`, `API_KEY` (optional) and `JWT_SECRET` (recommended)
3. git push heroku main

The `Procfile` is provided.

## Azure / Google Cloud Run (quick notes)

- Azure Web App: Use `az webapp up` or create Web App and set the `MONGODB_URI` and `API_KEY` config vars in the portal. Use `docker` option or deploy via GitHub Actions.
- Google Cloud Run: Build container, push to Container Registry, then `gcloud run deploy` and set env vars in the Cloud Run service settings.

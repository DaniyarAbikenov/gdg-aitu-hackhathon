# CareerBot frontend

Original React/Tailwind/shadcn application, integrated into the CareerBot monorepo. See [source provenance](UPSTREAM.md) and the [root README](../README.md) for architecture, Docker, providers and CI.

```bash
npm ci
npm run typecheck
npm run lint
npm run dev
```

Vite binds to loopback on port 5173 and forwards `/api` to the Docker gateway on port 8080. Production uses the frontend Dockerfile and Nginx with same-origin API routing. No Firebase credentials or build-time API secrets are required.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication

This app now uses Clerk with the Next.js App Router.

- `@clerk/nextjs` is installed and wired through `src/proxy.ts` with `clerkMiddleware()`.
- The root layout shows `Sign in`, `Sign up`, and `UserButton` controls through Clerk components.
- Clerk keyless mode works in local development, so you can run the app without setting Clerk keys first.

Canvas persistence is now scoped to the signed-in Clerk user. If you are not signed in, the app still keeps a local unsaved draft in `localStorage`, but server restore/save requires authentication.

## LLM Proxy Fallback

Canvas LLM now sends chat requests to the local Next.js API route at `/api/llm`.
That server route tries the local LiteLLM proxy first and falls back to the hosted Render proxy if local is unavailable.

Store the proxy configuration only in `.env.local`. This file is already ignored by git via `.env*`, so the proxy key and backup URL stay local to your machine.

Required local environment variables:

```bash
LLM_LOCAL_PROXY_URL=http://127.0.0.1:4000
LLM_REMOTE_PROXY_URL=https://litellm-render-deploy-nodocker.onrender.com
LLM_PROXY_KEY=your-shared-proxy-key
```

The app will return a configuration error if these values are missing.

The browser never calls the Render URL directly and never receives the proxy key.
Client code sends requests only to `/api/llm`, and that server route attaches the bearer token from environment variables on the server.

Create `.env.local` in the project root with those values.


You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Backend Completion Plan

The app is currently in a hybrid state:

- Auth is ready through Clerk.
- LLM requests already flow through the `/api/llm` backend route.
- Canvas persistence still uses file storage under `.data/`, which is fine for local development but not durable on serverless deployments.

To complete the backend with Convex:

1. Install `convex` and initialize the Convex project.
2. Create a `canvasStates` table keyed by `clerkUserId`.
3. Replace `/api/canvas-state` file I/O with Convex queries and mutations.
4. Add image storage through a durable provider and store image URLs in Convex instead of base64 blobs.
5. Deploy the Next.js app to Vercel and the LiteLLM proxy to Render or another always-on service.

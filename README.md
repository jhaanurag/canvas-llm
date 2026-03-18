# Canvas LLM

An infinite canvas-based LLM interface built with Next.js, Convex, and Clerk. Create, connect, and explore ideas through chat, notes, and drawings on a persistent digital workspace.
<img width="1824" height="899" alt="image" src="https://github.com/user-attachments/assets/1819a614-0dd5-49f2-a4ee-c393f3f358ad" />

## Features

- **Infinite Canvas**: Organize your thoughts spatially without boundaries.
- **Persistent State**: Your canvas is automatically saved to Convex and tied to your Clerk account.
- **Multi-modal Nodes**:
  - **Chat Nodes**: Interactive LLM conversations with context awareness.
  - **Note Nodes**: Rich text areas for documentation and synthesis.
  - **Drawing Nodes**: Visual expression directly on the canvas.
- **Contextual Connections**: Link nodes together to pass context between them.
- **Secure Architecture**: All LLM calls are proxied through a secure backend, protecting your API keys.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Database**: [Convex](https://www.convex.dev/) (Real-time synchronization)
- **Auth**: [Clerk](https://clerk.com/) (User management)
- **LLM Proxy**: [LiteLLM](https://github.com/BerriAI/litellm)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)

## Getting Started

### Prerequisites

- Node.js 18+
- A Convex account
- A Clerk account
- A LiteLLM proxy instance (local or remote)

### Environment Setup

Create a `.env.local` file in the root directory:

```bash
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# Convex Database
CONVEX_DEPLOYMENT=your_deployment_id
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# LLM Proxy Configuration
LLM_LOCAL_PROXY_URL=http://127.0.0.1:4000
LLM_REMOTE_PROXY_URL=https://your-remote-proxy.com
LLM_PROXY_KEY=your-shared-proxy-key
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/canvas-llm.git
   cd canvas-llm
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development environment:
   ```bash
   npm run dev
   ```
   This command runs both the Next.js development server and the Convex development window in parallel.

## Project Structure

- `convex/`: Database schema and server-side mutations/queries.
- `src/app/`: Next.js pages and API routes (including the `/api/llm` proxy).
- `src/components/canvas/`: The core canvas logic and node components.
- `src/lib/`: Shared utilities and LLM client logic.
- `src/types/`: TypeScript definitions for the canvas state and nodes.

## LLM Proxy Architecture

To ensure security and reliability, all LLM requests are routed through `src/app/api/llm/route.ts`. This route:
1. Verifies the user session via Clerk.
2. Implements a rate limiter to prevent abuse.
3. Attempts to reach a local LiteLLM proxy first.
4. Falls back to a remote proxy if the local one is unreachable.

## License

MIT


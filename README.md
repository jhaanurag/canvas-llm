# RabbitHoleAI

RabbitHoleAI is an infinite-canvas AI workspace built with Next.js and Convex. It lets you think spatially with chat, notes, and drawings, branch conversations into new windows, and keep long-running threads organized on a persistent canvas.

<img width="1824" height="899" alt="RabbitHoleAI canvas screenshot" src="https://github.com/user-attachments/assets/1819a614-0dd5-49f2-a4ee-c393f3f358ad" />

## Features

- **Infinite Canvas**: Lay out chats, notes, and drawings in a spatial workspace instead of a linear thread.
- **Chat Nodes**: Run LLM conversations in movable windows with editable titles, per-chat system prompts, attachments, and branching.
- **Context Management**: Add chat content to shared context, compress messages, edit raw context, and offload memory into a dedicated per-chat memory panel.
- **Deep-Dive Chat Spawning**: The main agent can open new chat windows with prefilled prompts for deeper parallel exploration.
- **Visual Feedback**: Animated agent-status bubbles and optional window entrance animations make async AI actions easier to follow.
- **Multi-modal Nodes**:
  - **Chat Nodes** for conversations and branching research flows.
  - **Note Nodes** for synthesis and documentation.
  - **Drawing Nodes** for sketches and visual context.
- **Email/Password Auth**: Create an account or sign in directly in the app using the built-in Convex auth flow.
- **Persistent State**: Your canvas is saved locally and to Convex when signed in.
- **Secure Architecture**: All LLM calls are proxied through the app backend so model credentials stay server-side.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Database / Sync**: [Convex](https://www.convex.dev/)
- **Auth**: Custom email/password auth implemented in Convex
- **LLM Proxy**: App-level proxy route with local/remote fallback
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) and app-specific canvas styling

## Getting Started

### Prerequisites

- Node.js 18+
- A Convex account
- A LiteLLM proxy instance (local or remote)

### Environment Setup

Create a `.env.local` file in the root directory:

```bash
# Convex Database
CONVEX_DEPLOYMENT=your_deployment_id
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# App Auth
AUTH_JWT_SECRET=replace_with_a_long_random_secret
AUTH_JWT_ISSUER=rabbitholeai

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

## Project Structure

- `convex/`: Convex schema, auth, and canvas persistence logic.
- `src/app/`: Next.js routes, global styles, and the `/api/llm` proxy.
- `src/components/canvas/`: Infinite canvas UI, chat nodes, notes, drawings, and orchestration behavior.
- `src/lib/`: Shared LLM and utility helpers.
- `src/types/`: TypeScript definitions for canvas state, nodes, messages, and memory entries.

## LLM Proxy Architecture

All model requests are routed through `src/app/api/llm/route.ts`. This route:

1. Keeps model credentials server-side.
2. Supports both authenticated and anonymous app usage.
3. Applies rate limiting.
4. Tries the local proxy first.
5. Falls back to a remote proxy if the local endpoint is unavailable.

## License

MIT

# RabbitHoleAI

RabbitHoleAI is an infinite-canvas LLM workspace built with Next.js and Convex. It lets you explore ideas spatially with chat, notes, and drawings while keeping model access behind a secure app proxy.

<img width="1824" height="899" alt="RabbitHoleAI canvas screenshot" src="https://github.com/user-attachments/assets/1819a614-0dd5-49f2-a4ee-c393f3f358ad" />

## Features

- **Infinite Canvas**: Organize conversations and notes spatially instead of forcing everything into one linear thread.
- **Email/Password Auth**: Create an account or sign in directly in the app using the built-in Convex auth flow.
- **Persistent State**: Save your canvas, node layout, and chat state to Convex.
- **Multi-modal Nodes**:
  - **Chat Nodes** for interactive LLM conversations.
  - **Note Nodes** for scratch work and synthesis.
  - **Drawing Nodes** for diagrams and sketches.
- **Context Management**: Branch chats, offload message memory, edit stored context, and spawn focused deep-dive chats from the main canvas.
- **Responsive Agent Feedback**: Show in-chat processing feedback while the agent is thinking or syncing memory.
- **Secure LLM Access**: Route model requests through `src/app/api/llm/route.ts` so provider keys stay server-side.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Database / Sync**: [Convex](https://www.convex.dev/)
- **Auth**: Custom email/password auth implemented in Convex
- **LLM Proxy**: [LiteLLM](https://github.com/BerriAI/litellm)
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
- `src/app/`: Next.js routes, layouts, and the `/api/llm` proxy.
- `src/components/canvas/`: Canvas UI, chat nodes, node controls, and orchestration behavior.
- `src/lib/`: Shared LLM and utility helpers.
- `src/types/`: Shared TypeScript definitions for canvas state and node data.

## LLM Proxy Architecture

All model requests are routed through `src/app/api/llm/route.ts`. This route:

1. Accepts authenticated and anonymous usage while keeping provider credentials server-side.
2. Applies rate limiting.
3. Tries a local LiteLLM proxy first for development.
4. Falls back to a remote proxy when the local endpoint is unavailable.

## License

MIT

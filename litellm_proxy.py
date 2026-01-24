import os
import uvicorn
from fastapi import FastAPI, Request, Response
import httpx
import asyncio
import logging
from pydantic import BaseModel

# Configuration
LITELLM_URL = "http://localhost:4001"  # Real LiteLLM running here
DEFAULT_LIMIT = 5                      # Default limit
PORT = 4000                            # Proxy port

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("proxy")

app = FastAPI()
# Use a long timeout or no timeout for LLM requests
client = httpx.AsyncClient(base_url=LITELLM_URL, timeout=600.0)

class RateLimiter:
    def __init__(self, limit):
        self.limit = limit
        self.current = 0
        self.condition = asyncio.Condition()

    async def acquire(self):
        async with self.condition:
            while self.current >= self.limit:
                logger.info(f"Queue full ({self.current}/{self.limit}). Waiting for slot...")
                await self.condition.wait()
            self.current += 1
            logger.debug(f"Request acquired slot. Active: {self.current}/{self.limit}")

    async def release(self):
        async with self.condition:
            self.current -= 1
            self.condition.notify() # Wake up one waiter
            logger.debug(f"Request released slot. Active: {self.current}/{self.limit}")

    async def update_limit(self, new_limit):
        async with self.condition:
            old_limit = self.limit
            self.limit = new_limit
            logger.info(f"Limit updated: {old_limit} -> {new_limit}")
            # If limit increased, wake up everyone to check if they can enter
            if new_limit > old_limit:
                self.condition.notify_all()

    def get_status(self):
        return {"limit": self.limit, "active_requests": self.current}

limiter = RateLimiter(DEFAULT_LIMIT)

class ConfigUpdate(BaseModel):
    limit: int

@app.post("/proxy/config")
async def update_config(config: ConfigUpdate):
    """API endpoint to update the concurrency limit on the fly."""
    await limiter.update_limit(config.limit)
    return {"message": "Limit updated", "status": limiter.get_status()}

@app.get("/proxy/status")
async def get_status():
    """API endpoint to check current queue status."""
    return limiter.get_status()

@app.middleware("http")
async def limit_concurrency(request: Request, call_next):
    # Skip limiting for our admin endpoints
    if request.url.path.startswith("/proxy/"):
        return await call_next(request)

    await limiter.acquire()
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return Response(content="Internal Server Error", status_code=500)
    finally:
        await limiter.release()

@app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def catch_all(request: Request, path_name: str):
    # This captures everything ensuring it goes to LiteLLM
    url = f"/{path_name}"
    if request.query_params:
        url += f"?{request.query_params}"

    # logger.info(f"Forwarding: {url}") # Uncomment for verbose logs

    body = await request.body()
    
    try:
        req = client.build_request(
            request.method,
            url,
            headers=request.headers.raw,
            content=body
        )
        r = await client.send(req, stream=False)
        
        return Response(
            content=r.content,
            status_code=r.status_code,
            headers=r.headers
        )
    except httpx.ConnectError:
        return Response(content="LiteLLM service appears to be down on port 4001", status_code=502)
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        return Response(content=str(e), status_code=500)

if __name__ == "__main__":
    print(f"Starting Smart Proxy on port {PORT}...")
    print(f"Forwarding to {LITELLM_URL}")
    print(f"Initial concurrency limit: {DEFAULT_LIMIT}")
    print(f"Update limit via POST http://localhost:{PORT}/proxy/config")
    uvicorn.run(app, host="0.0.0.0", port=PORT)

#!/bin/bash
# Start litellm in the background
# Make sure to set any necessary ENV vars in Render dashboard
litellm --config config.yaml --port 4001 &

# Wait for litellm to be ready (optional but recommended)
sleep 2

# Start the Python proxy in the foreground
python litellm_proxy.py

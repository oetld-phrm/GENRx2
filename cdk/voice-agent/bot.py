"""Voice agent entry point — stdin/stdout transport.

This replaces the previous WebRTC/FastAPI server. The agent is now
spawned as a child process by the Node.js socket server and communicates
via newline-delimited JSON over stdin (commands in) and stdout (events out).

It can also run as an AgentCore-hosted container — the socket server
spawns it the same way regardless of where the container lives.
"""

import asyncio
from nova_sonic import main

if __name__ == "__main__":
    asyncio.run(main())

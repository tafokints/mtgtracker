"""Disposable, loopback-only Upstash REST emulator for Lua integration checks.

Run: uv run --with 'fakeredis[lua]' python scripts/redis-test-server.py
All records are in memory. Never use this fixture in a deployment.
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer

import fakeredis


database = fakeredis.FakeRedis(decode_responses=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.respond({"fixture": "mtgtrackers-isolated-redis"})

    def do_POST(self):
        if self.headers.get("Authorization") != "Bearer fixture-only":
            self.respond({"error": "Fixture token required"}, 401)
            return
        try:
            command = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            result = database.execute_command(*command)
            if isinstance(result, set):
                result = list(result)
            if isinstance(result, bool):
                result = "OK" if result else None
            self.respond({"result": result})
        except Exception as error:
            self.respond({"error": str(error)})

    def respond(self, value, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(value).encode())


print("Disposable Redis fixture on http://127.0.0.1:8079", flush=True)
HTTPServer(("127.0.0.1", 8079), Handler).serve_forever()

"""Disposable, loopback-only Upstash REST emulator for Lua integration checks.

Run: uv run --with 'fakeredis[lua]' python scripts/redis-test-server.py
All records are in memory. Never use this fixture in a deployment.
"""

import json
import base64
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
            if self.path in ("/pipeline", "/multi-exec"):
                self.respond([self.execute(item) for item in command])
            else:
                self.respond(self.execute(command))
        except Exception as error:
            self.respond({"error": str(error)})

    def execute(self, command):
        try:
            result = database.execute_command(*command)
            if isinstance(result, set):
                result = list(result)
            if isinstance(result, bool):
                result = "OK" if result else None
            if self.headers.get("Upstash-Encoding") == "base64":
                result = self.encode(result)
            return {"result": result}
        except Exception as error:
            return {"error": str(error)}

    def encode(self, value):
        if isinstance(value, str) and value != "OK":
            return base64.b64encode(value.encode()).decode()
        if isinstance(value, list):
            return [self.encode(item) for item in value]
        return value

    def respond(self, value, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(value).encode())


print("Disposable Redis fixture on http://127.0.0.1:8079", flush=True)
HTTPServer(("127.0.0.1", 8079), Handler).serve_forever()

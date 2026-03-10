#!/usr/bin/env python3
"""
KOYA Confidential Server
========================
Serves the MVP blueprint page on localhost.
mvp.html is the default page.

Usage:
    python3 serve.py                    # start on port 9999
    python3 serve.py --port 8080        # custom port
"""

import http.server
import socketserver
import os
import sys
import argparse
import socket

# ─── Configuration ───────────────────────────────────────────────
SERVE_DIR = os.path.dirname(os.path.abspath(__file__))


def get_local_ip():
    """Get the machine's local network IP."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class KoyaHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler that serves mvp.html as the default page."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SERVE_DIR, **kwargs)

    def do_GET(self):
        # Serve mvp.html as default page
        if self.path == "/" or self.path == "/index.html":
            self.path = "/mvp.html"

        # Block serve.py from being downloaded
        if self.path.endswith("serve.py"):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        super().do_GET()


def main():
    parser = argparse.ArgumentParser(description="KOYA Confidential Server")
    parser.add_argument(
        "--port", type=int, default=9999,
        help="Port to serve on (default: 9999)"
    )
    args = parser.parse_args()

    local_ip = get_local_ip()

    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("0.0.0.0", args.port), KoyaHandler) as httpd:
        print()
        print("╔══════════════════════════════════════════════════╗")
        print("║            KOYA SERVER                          ║")
        print("╠══════════════════════════════════════════════════╣")
        print(f"║  Serving:    {SERVE_DIR:<36}║")
        print(f"║  Default:    mvp.html{' ':<28}║")
        print(f"║  Port:       {args.port:<36}║")
        print(f"║  Local URL:  http://127.0.0.1:{args.port:<19}║")
        print(f"║  LAN URL:    http://{local_ip}:{args.port:<18}║")
        print("╠══════════════════════════════════════════════════╣")
        print("║  Press Ctrl+C to stop                            ║")
        print("╚══════════════════════════════════════════════════╝")
        print()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server stopped.")
            httpd.server_close()


if __name__ == "__main__":
    main()

"""Send one test note to SuperDirt over OSC, the same way Tidal does.

Usage (with sc/startup.scd running):
    .venv/bin/python analysis/osc_ping.py            # plays sctest
    .venv/bin/python analysis/osc_ping.py --rel 3    # long release (gate test)

Useful to check the SuperDirt side without Tidal or Strudel involved.
"""

import argparse

from pythonosc.udp_client import SimpleUDPClient


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sound", default="sctest")
    parser.add_argument("--n", type=float, default=0.0)
    parser.add_argument("--bright", type=float, default=0.5)
    parser.add_argument("--rel", type=float, default=0.3)
    parser.add_argument("--delta", type=float, default=0.25)
    parser.add_argument("--port", type=int, default=57120)
    args = parser.parse_args()

    client = SimpleUDPClient("127.0.0.1", args.port)
    # SuperDirt's /dirt/play takes alternating key/value pairs.
    client.send_message(
        "/dirt/play",
        [
            "s", args.sound,
            "n", args.n,
            "delta", args.delta,
            "tstbright", args.bright,
            "tstrel", args.rel,
            "orbit", 0,
        ],
    )
    print(f"sent {args.sound} n={args.n} rel={args.rel} to port {args.port}")


if __name__ == "__main__":
    main()

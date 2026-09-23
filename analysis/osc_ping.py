"""Send one test note to SuperDirt over OSC, the same way Tidal does.

Usage (with sc/startup.scd running):
    .venv/bin/python analysis/osc_ping.py                     # default scstd note
    .venv/bin/python analysis/osc_ping.py --rel 3             # long release (gate test)
    .venv/bin/python analysis/osc_ping.py vcfcut=300 vcfres=0.9   # any extra params

Useful to check the SuperDirt side without Tidal or Strudel involved.
"""

import argparse

from pythonosc.udp_client import SimpleUDPClient


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--sound", default="scstd")
    parser.add_argument("--n", type=float, default=0.0)
    parser.add_argument("--rel", type=float, default=None, help="sets both erel and arrel (s)")
    parser.add_argument("--delta", type=float, default=0.25)
    parser.add_argument("--port", type=int, default=57120)
    parser.add_argument("params", nargs="*", help="extra params as name=value")
    args = parser.parse_args()

    msg = ["s", args.sound, "n", args.n, "delta", args.delta, "orbit", 0]
    if args.rel is not None:
        msg += ["erel", args.rel, "arrel", args.rel]
    for item in args.params:
        name, value = item.split("=", 1)
        msg += [name, float(value)]

    # SuperDirt's /dirt/play takes alternating key/value pairs.
    SimpleUDPClient("127.0.0.1", args.port).send_message("/dirt/play", msg)
    print(f"sent {msg} to port {args.port}")


if __name__ == "__main__":
    main()

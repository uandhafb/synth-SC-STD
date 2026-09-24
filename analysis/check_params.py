"""Check that parameter names are in sync across the project (CLAUDE.md, decision 8).

Compares: docs/params.md, tidal/params.hs, strudel/params.js, sc/synthdefs/00_modules.scd,
and checks that BootTidal.hs is up to date with tidal/params.hs (analysis/build_boot.py).
Usage:  .venv/bin/python analysis/check_params.py   (exit code 1 on mismatch)
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def from_docs() -> set[str]:
    text = (ROOT / "docs/params.md").read_text()
    text = text.split("## Standard SuperDirt params")[0]
    return set(re.findall(r"^\| `([a-z0-9_]+)` \|", text, re.M))


def from_tidal() -> set[str]:
    return set(re.findall(r'pF "([a-z0-9_]+)"', (ROOT / "tidal/params.hs").read_text()))


def from_strudel() -> set[str]:
    text = (ROOT / "strudel/params.js").read_text()
    body = text.split("createParams(")[1].split(");")[0]
    body = re.sub(r"//.*", "", body)
    return set(re.findall(r"'([a-z0-9_]+)'", body))


def from_sc() -> set[str]:
    text = re.sub(r"//.*", "", (ROOT / "sc/synthdefs/00_modules.scd").read_text())
    body = text.split("~scstdSpecs = (")[1].split(");")[0]
    return set(re.findall(r"([a-z0-9_]+):\s*\[", body))


def main() -> int:
    sources = {"docs": from_docs(), "tidal": from_tidal(), "strudel": from_strudel(), "sc": from_sc()}
    all_names = set().union(*sources.values())
    ok = True
    for name in sorted(all_names):
        missing = [k for k, v in sources.items() if name not in v]
        if missing:
            ok = False
            print(f"{name}: missing in {', '.join(missing)}")
    from build_boot import expected
    if (ROOT / "BootTidal.hs").read_text() != expected():
        ok = False
        print("BootTidal.hs is out of date: run .venv/bin/python analysis/build_boot.py")
    print(f"{len(all_names)} params, {'in sync' if ok else 'OUT OF SYNC'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

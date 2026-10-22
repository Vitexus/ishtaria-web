#!/usr/bin/env python3
"""Build the portal into a temp dir and verify structure, i18n parity and local links."""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []

en = json.loads((ROOT / "i18n/en.json").read_text(encoding="utf-8"))
cs = json.loads((ROOT / "i18n/cs.json").read_text(encoding="utf-8"))
if set(en) != set(cs):
    errors.append(f"i18n key mismatch: {sorted(set(en) ^ set(cs))}")
site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
for p in site["packages"]:
    if f"pkg_{p}" not in en:
        errors.append(f"missing description for package {p}")

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run([sys.executable, str(ROOT / "build.py"), tmp], check=True, stdout=subprocess.DEVNULL)
    out = Path(tmp)
    for f in out.rglob("*.html"):
        text = f.read_text(encoding="utf-8")
        for href in re.findall(r'(?:href|src)="([^"]+)"', text):
            if re.match(r"(https?:|/|#|mailto:)", href):
                continue
            if not (f.parent / href).resolve().exists():
                errors.append(f"{f.relative_to(out)}: broken link {href}")
    launch = site["web_client"]["path"]
    if site["web_client"].get("default_server"):
        launch = f'{launch}?server={site["web_client"]["default_server"]}'
    for lang in ("", "cs/"):
        for page in ("index.html", "download.html", "play.html"):
            if not (out / lang / page).exists():
                errors.append(f"missing {lang}{page}")
        index_html = (out / lang / "index.html").read_text(encoding="utf-8")
        if f'href="{launch}"' not in index_html:
            errors.append(f"{lang}index.html: missing web-client launch link {launch}")

if errors:
    print("\n".join(errors))
    sys.exit(1)
print("ok")

#!/usr/bin/env python3
"""Generate the static Ishtaria portal (English at /, Czech at /cs/).

Usage: build.py [OUTPUT_DIR]   (default: build/html)
Only the Python standard library is used.
"""
import html
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAGES = ("index", "download", "play")
LANGS = ("en", "cs")


def e(text):
    return html.escape(text, quote=True)


def layout(t, site, lang, page, body):
    prefix = "../" if lang == "cs" else ""
    other = "en" if lang == "cs" else "cs"
    switch = f"{prefix}{page}.html" if lang == "cs" else f"cs/{page}.html"
    nav = "".join(
        f'<a href="{p}.html"{" aria-current=\"page\"" if p == page else ""}>{e(t[k])}</a>'
        for p, k in (("index", "nav_home"), ("download", "nav_download"), ("play", "nav_play"))
    )
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(t["name"])} – {e(t["nav_" + ("home" if page == "index" else page)])}</title>
<meta name="description" content="{e(t["tagline"])}">
<link rel="stylesheet" href="{prefix}style.css">
<link rel="icon" href="{prefix}favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png">
<meta property="og:title" content="{e(t["name"])}">
<meta property="og:description" content="{e(t["tagline"])}">
<meta property="og:image" content="{prefix}og-image.jpg">
<link rel="alternate" hreflang="{other}" href="{switch}">
</head>
<body>
<header class="top">
  <a class="brand" href="index.html"><img src="{prefix}logo.png" alt="" width="32" height="32">{e(t["name"])}</a>
  <nav>{nav}<a href="{e(site["docs_url"])}">{e(t["nav_docs"])}</a>
  <a class="lang" lang="{other}" hreflang="{other}" href="{switch}">{e(t["footer_lang"])}</a></nav>
</header>
<main>
{body}
</main>
<footer><p>{e(t["footer_license"])}</p>
<p><a href="{e(site["github"])}">GitHub</a> · <a href="{e(site["patreon"])}" rel="noopener">Patreon – {e(t["footer_support"])}</a></p></footer>
</body>
</html>
"""


def web_client_launch(site):
    """Absolute URL that opens the browser client against this site's default server."""
    path = site["web_client"]["path"]
    default = site["web_client"].get("default_server")
    if not default:
        return path
    sep = "&" if "?" in path else "?"
    return f"{path}{sep}server={default}"


def index(t, site):
    prefix = "../" if t["lang"] == "cs" else ""
    launch = web_client_launch(site)
    shots = "".join(
        f'<figure><img src="{prefix}screenshot-{name}.jpg" alt="{e(t[f"shot_{i}_alt"])}" width="1200" height="675" loading="lazy">'
        f'<figcaption>{e(t[f"shot_{i}_alt"])}</figcaption></figure>'
        for i, name in enumerate(("uruk", "market", "quay", "dialogue", "map"), 1)
    )
    feats = "".join(
        f'<article><h3>{e(t[f"feat_{i}_h"])}</h3><p>{e(t[f"feat_{i}_p"])}</p></article>'
        for i in range(1, 5)
    )
    return f"""<section class="hero"><h1>{e(t["home_title"])}</h1>
<p class="lead">{e(t["home_lead"])}</p>
<p><a class="button" href="download.html">{e(t["home_cta"])}</a> <a class="button" href="{e(launch)}">{e(t["home_cta_play"])}</a></p></section>
<section><h2>{e(t["feat_title"])}</h2><div class="grid">{feats}</div></section>
<section><h2>{e(t["story_title"])}</h2><p class="lead">{e(t["story_p"])}</p></section>
<section><h2>{e(t["shots_title"])}</h2><div class="shots">{shots}</div></section>
<section><h2>{e(t["support_title"])}</h2><p class="lead">{e(t["support_p"])}</p>
<p><a class="button" href="{e(site["patreon"])}" rel="noopener">{e(t["support_cta"])}</a> <a class="button" href="{e(site["github"])}">{e(t["support_code"])}</a></p></section>
<section class="note"><h2>{e(t["status_title"])}</h2><p>{e(t["status_p"])}</p></section>"""


def download(t, site):
    repo = site["repo_url"]
    setup = (
        f"sudo wget -O /usr/share/keyrings/vitexsoftware.gpg {repo}/KEY.gpg\n"
        f'echo "deb [signed-by=/usr/share/keyrings/vitexsoftware.gpg] {repo} $(lsb_release -sc) main games" '
        "| sudo tee /etc/apt/sources.list.d/vitexsoftware.list\n"
        "sudo apt update"
    )
    play = "sudo apt install " + " ".join(site["play"])
    host = "sudo apt install " + " ".join(site["host"])
    rows = "".join(
        f'<tr><td><code>{e(p)}</code></td><td>{e(t["pkg_" + p])}</td>'
        f'<td><a href="{e(site["github"])}/{e(site["sources"].get(p, p))}">'
        f'{e(site["sources"].get(p, p))}</a></td></tr>'
        for p in site["packages"]
    )
    rel = site["release"]
    base = f'{rel["repo"]}/download/{rel["tag"]}'
    files = "".join(
        f'<tr><td><a href="{e(base)}/{e(f["file"])}"><code>{e(f["file"])}</code></a></td>'
        f'<td>{e(t[f["label"]])}</td></tr>'
        for f in rel["files"]
    )
    direct = (
        f'<h2>{e(t["dl_direct_h"])}</h2><p>{e(t["dl_direct_p"])}</p>'
        f'<div class="scroll"><table><thead><tr><th>{e(t["dl_col_file"])}</th><th>{e(t["dl_col_for"])}</th></tr></thead>'
        f'<tbody>{files}</tbody></table></div>'
        f'<p><a href="{e(rel["repo"])}/tag/{e(rel["tag"])}">{e(t["dl_all_releases"])}</a></p>'
    )
    return f"""<h1>{e(t["dl_title"])}</h1><p class="lead">{e(t["dl_lead"])}</p>
<h2>{e(t["dl_step1_h"])}</h2><pre><code>{e(setup)}</code></pre>
<h2>{e(t["dl_step2_h"])}</h2>
<div class="grid"><article><h3>{e(t["dl_play"])}</h3><p>{e(t["dl_play_p"])}</p><pre><code>{e(play)}</code></pre></article>
<article><h3>{e(t["dl_host"])}</h3><p>{e(t["dl_host_p"])}</p><pre><code>{e(host)}</code></pre></article></div>
{direct}
<h2>{e(t["dl_table_h"])}</h2>
<div class="scroll"><table><thead><tr><th>{e(t["dl_col_package"])}</th><th>{e(t["dl_col_what"])}</th><th>{e(t["dl_col_source"])}</th></tr></thead>
<tbody>{rows}</tbody></table></div>
<h2>{e(t["dl_req_h"])}</h2><p>{e(t["dl_req_p"])}</p>"""


def play(t, site):
    path = site["web_client"]["path"]
    launch = web_client_launch(site)
    open_here = ""
    if site["web_client"].get("default_server"):
        open_here = (
            f'<p><a class="button" href="{e(launch)}">{e(t["play_open_here"])}</a></p>'
            f'<p class="lead">{e(t["play_open_here_p"])}</p>'
        )
    return f"""<h1>{e(t["play_title"])}</h1><p class="lead">{e(t["play_lead"])}</p>
{open_here}
<form action="{e(path)}" method="get"><p><label for="server">{e(t["play_server_label"])}</label><br>
<input id="server" name="server" type="text" size="40" maxlength="200" placeholder="{e(t["play_server_ph"])}" required>
<button class="button" type="submit">{e(t["play_button"])}</button></p></form>
<h2>{e(t["play_how_h"])}</h2><p>{e(t["play_how_p"])}</p>
<h2>{e(t["play_https_h"])}</h2><p>{e(t["play_https_p"])}</p>
<h2>{e(t["play_limits_h"])}</h2><p>{e(t["play_limits_p"])}</p>
<h2>{e(t["play_host_h"])}</h2><p>{e(t["play_host_p"])}</p><pre><code>sudo apt install ishtaria-client-web</code></pre>"""


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "build" / "html"
    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    if out.exists():
        shutil.rmtree(out)
    (out / "cs").mkdir(parents=True)
    for asset in (ROOT / "static").iterdir():
        shutil.copy(asset, out / asset.name)
    builders = {"index": index, "download": download, "play": play}
    for lang in LANGS:
        t = json.loads((ROOT / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
        for page in PAGES:
            target = out / ("cs" if lang == "cs" else "") / f"{page}.html"
            target.write_text(layout(t, site, lang, page, builders[page](t, site)), encoding="utf-8")
    print(f"built {len(LANGS) * len(PAGES)} pages into {out}")


if __name__ == "__main__":
    main()

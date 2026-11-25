"""Builds wag-and-tails.zip from the wp-plugin folder, ready to upload in WordPress.

Run on your PC, in the project folder:   python infra/vps/build-plugin-zip.py
Result: infra/vps/wag-and-tails.zip  (the folder inside the zip is called "wag-and-tails", paths use forward slashes).
Windows' own "Send to > Compressed folder" makes zips WordPress can choke on; use this instead.
"""
import os
import re
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "wp-plugin")
OUT = os.path.join(ROOT, "infra", "vps", "wag-and-tails.zip")

main = open(os.path.join(SRC, "wag-and-tails.php"), encoding="utf-8").read()
version = re.search(r"Version:\s*([0-9.]+)", main)
print("Plugin version in the code:", version.group(1) if version else "unknown")

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for folder, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for name in sorted(files):
            if name.endswith((".zip", ".log")) or name in (".DS_Store", "Thumbs.db"):
                continue
            full = os.path.join(folder, name)
            rel = os.path.relpath(full, SRC).replace(os.sep, "/")
            z.write(full, "wag-and-tails/" + rel)
            count += 1
print(f"Wrote {OUT} with {count} files")
if count < 10:
    sys.exit("Too few files, something is wrong")

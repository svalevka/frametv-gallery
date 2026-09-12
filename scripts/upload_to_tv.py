#!/usr/bin/env python3
"""Upload one or more images directly to a Samsung Frame TV's Art Mode over Wi-Fi.

Prints a single JSON object to stdout: {"results": [{"file", "ok", "content_id"|"error"}, ...]}

First run against a given TV will pop up an "Allow connection?" prompt on the
TV itself — accept it with the remote. After that, samsungtvws caches an auth
token in --token-file so future runs connect silently.
"""
import argparse
import json
import sys
from pathlib import Path

from samsungtvws import SamsungTVWS
from samsungtvws.exceptions import ConnectionFailure, UnauthorizedError

FILE_TYPE_BY_SUFFIX = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ip", required=True, help="Frame TV IP address")
    parser.add_argument("--token-file", required=True)
    parser.add_argument("--matte", default="none", help="Matte style, e.g. none, modern, shadowbox")
    parser.add_argument("images", nargs="+")
    args = parser.parse_args()

    tv = SamsungTVWS(host=args.ip, port=8002, token_file=args.token_file, name="FrameTVGallery")
    art = tv.art()

    results = []
    for image_path in args.images:
        path = Path(image_path)
        file_type = FILE_TYPE_BY_SUFFIX.get(path.suffix.lower())
        if not file_type:
            results.append({"file": path.name, "ok": False, "error": f"unsupported file type {path.suffix}"})
            continue
        try:
            data = path.read_bytes()
        except OSError as e:
            results.append({"file": path.name, "ok": False, "error": f"Could not read file: {e}"})
            continue

        try:
            content_id = art.upload(data, file_type=file_type, matte=args.matte)
            results.append({"file": path.name, "ok": True, "content_id": content_id})
        except UnauthorizedError:
            results.append({
                "file": path.name,
                "ok": False,
                "error": f"TV at {args.ip} rejected the connection — accept the pairing prompt on the TV, then try again.",
            })
        except (ConnectionFailure, OSError):
            results.append({
                "file": path.name,
                "ok": False,
                "error": f"Failed to connect to Smart TV over IP address {args.ip}",
            })
        except Exception as e:  # noqa: BLE001 - surface any other failure back to the caller
            results.append({"file": path.name, "ok": False, "error": str(e)})

    print(json.dumps({"results": results}))
    if any(not r["ok"] for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""CI-only COS publisher. Reads credentials solely from environment variables."""
from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.request
from pathlib import Path


def required(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"Missing required CI secret: {name}")
    return value


def key_for(root: Path, item: Path) -> str:
    relative = item.resolve().relative_to(root.resolve()).as_posix()
    if relative == "manifests/remote-asset-manifest-v1.json":
        return relative
    if relative.startswith(".") or ".." in Path(relative).parts:
        raise RuntimeError(f"Unsafe remote asset path: {relative}")
    return relative


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--changed-file-list", required=True)
    parser.add_argument("--publish-manifest", action="store_true")
    parser.add_argument("--cdn-base-url", required=True)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    changed = [Path(line.strip()).resolve() for line in Path(args.changed_file_list).read_text(encoding="utf-8").splitlines() if line.strip()]
    for item in changed:
        if not item.is_file() or root not in item.parents:
            raise RuntimeError(f"Refusing to upload a file outside assets/remote: {item}")

    from qcloud_cos import CosConfig, CosS3Client
    config = CosConfig(Region=required("TENCENT_COS_REGION"), SecretId=required("TENCENT_CLOUD_SECRET_ID"), SecretKey=required("TENCENT_CLOUD_SECRET_KEY"), Token=None, Scheme="https")
    bucket = required("TENCENT_COS_BUCKET")
    client = CosS3Client(config)
    manifest = root / "manifests/remote-asset-manifest-v1.json"
    assets = [item for item in changed if item != manifest]

    # Resource objects are always complete and HEAD-checked before the manifest advances.
    for item in assets:
        key = key_for(root, item)
        client.upload_file(Bucket=bucket, Key=key, LocalFilePath=str(item), EnableMD5=True)
        head = client.head_object(Bucket=bucket, Key=key)
        if int(head.get("ContentLength", 0)) != item.stat().st_size:
            raise RuntimeError(f"COS size mismatch after upload: {key}")
        print(f"uploaded {key}")

    if args.publish_manifest:
        client.upload_file(Bucket=bucket, Key=key_for(root, manifest), LocalFilePath=str(manifest), EnableMD5=True)
        head = client.head_object(Bucket=bucket, Key=key_for(root, manifest))
        if int(head.get("ContentLength", 0)) != manifest.stat().st_size:
            raise RuntimeError("COS size mismatch after manifest upload")
        print("published manifests/remote-asset-manifest-v1.json")

    # CDN propagation is outside COS's control; bounded retries make the result observable.
    for item in assets + ([manifest] if args.publish_manifest else []):
        key = key_for(root, item)
        url = args.cdn_base_url.rstrip("/") + "/" + key
        for attempt in range(5):
            try:
                request = urllib.request.Request(url, method="HEAD")
                with urllib.request.urlopen(request, timeout=20) as response:
                    length = int(response.headers.get("Content-Length", "0"))
                    if response.status == 200 and length > 0:
                        print(f"cdn verified {key}")
                        break
            except Exception as error:
                if attempt == 4:
                    raise RuntimeError(f"CDN verification failed for {key}: {error}") from error
                time.sleep(3 * (attempt + 1))
        else:
            raise RuntimeError(f"CDN verification failed for {key}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"COS publish failed: {error}", file=sys.stderr)
        raise SystemExit(1)

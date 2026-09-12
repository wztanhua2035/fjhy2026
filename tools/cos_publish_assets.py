#!/usr/bin/env python3
"""CI-only COS publisher. Reads credentials solely from environment variables."""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
import time
import urllib.request
from pathlib import Path
from typing import Callable

SIMPLE_UPLOAD_LIMIT_BYTES = 32 * 1024 * 1024
SIMPLE_PUT_RETRIES = 3
MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024
CDN_VERIFY_RETRIES = 5


def log(message: str) -> None:
    print(message, flush=True)


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


def upload_strategy(size: int) -> str:
    return "simple-put" if size <= SIMPLE_UPLOAD_LIMIT_BYTES else "multipart"


def error_details(error: Exception) -> str:
    """Return COS diagnostics without serializing exception text or environment values."""
    fields = [f"error={type(error).__name__}"]
    for label, method_name in (("code", "get_error_code"), ("request_id", "get_request_id")):
        method = getattr(error, method_name, None)
        if callable(method):
            value = method()
            if value:
                fields.append(f"{label}={value}")
    return " ".join(fields)


def head_value(head: dict[object, object], name: str) -> object | None:
    expected = name.replace("-", "").lower()
    for key, value in head.items():
        if str(key).replace("-", "").lower() == expected:
            return value
    return None


def content_length_from_head(head: dict[object, object]) -> int:
    value = head_value(head, "content-length")
    if value is None:
        keys = ", ".join(sorted(str(key) for key in head))
        raise RuntimeError(f"COS HEAD missing content length; fields=[{keys}]")
    try:
        return int(value)
    except (TypeError, ValueError) as error:
        raise RuntimeError("COS HEAD invalid content length") from error


def local_md5(item: Path) -> str:
    digest = hashlib.md5(usedforsecurity=False)
    with item.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def existing_object_matches(head: dict[object, object], item: Path) -> bool:
    remote_size = content_length_from_head(head)
    etag = head_value(head, "etag")
    if remote_size != item.stat().st_size or not isinstance(etag, str):
        return False
    return etag.strip('"').lower() == local_md5(item)


def upload_object(client: object, bucket: str, key: str, item: Path, *, sleep: Callable[[float], None] = time.sleep) -> None:
    size = item.stat().st_size
    strategy = upload_strategy(size)
    if strategy == "simple-put":
        last_error: Exception | None = None
        for attempt in range(1, SIMPLE_PUT_RETRIES + 1):
            log(f"upload {key} method=simple-put size={size} attempt={attempt}")
            try:
                with item.open("rb") as body:
                    client.put_object(Bucket=bucket, Key=key, Body=body, EnableMD5=True)
                return
            except Exception as error:
                last_error = error
                log(f"upload retry {key} method=simple-put size={size} {error_details(error)}")
                if attempt < SIMPLE_PUT_RETRIES:
                    sleep(1 if attempt == 1 else 3)
        raise RuntimeError(f"simple-put failed after {SIMPLE_PUT_RETRIES} attempts: {key}") from last_error

    last_error = None
    for attempt in range(1, SIMPLE_PUT_RETRIES + 1):
        log(f"upload {key} method=multipart size={size} part_size={MULTIPART_PART_SIZE_BYTES} attempt={attempt}")
        try:
            client.upload_file(Bucket=bucket, Key=key, LocalFilePath=str(item), PartSize=MULTIPART_PART_SIZE_BYTES, EnableMD5=True)
            return
        except Exception as error:
            last_error = error
            log(f"upload retry {key} method=multipart size={size} {error_details(error)}")
            if attempt < SIMPLE_PUT_RETRIES:
                sleep(1 if attempt == 1 else 3)
    raise RuntimeError(f"multipart upload failed after {SIMPLE_PUT_RETRIES} attempts: {key}") from last_error


def verify_cos_size(client: object, bucket: str, key: str, item: Path) -> None:
    head = client.head_object(Bucket=bucket, Key=key)
    remote_size = content_length_from_head(head)
    if remote_size != item.stat().st_size:
        raise RuntimeError(f"COS size mismatch after upload: {key}")
    log(f"cos verified {key} local_size={item.stat().st_size} remote_size={remote_size}")


def upload_or_reuse_object(client: object, bucket: str, key: str, item: Path) -> None:
    try:
        head = client.head_object(Bucket=bucket, Key=key)
        if existing_object_matches(head, item):
            log(f"reuse existing {key} size={item.stat().st_size} etag=matched")
            return
    except Exception as error:
        log(f"existing object unavailable {key} {error_details(error)}")
    upload_object(client, bucket, key, item)


def verify_cdn(key: str, cdn_base_url: str, *, sleep: Callable[[float], None] = time.sleep) -> None:
    url = cdn_base_url.rstrip("/") + "/" + key
    last_error: Exception | None = None
    for attempt in range(1, CDN_VERIFY_RETRIES + 1):
        try:
            request = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(request, timeout=20) as response:
                length = int(response.headers.get("Content-Length", "0"))
                if response.status == 200 and length > 0:
                    log(f"cdn verified {key} size={length}")
                    return
                last_error = RuntimeError(f"unexpected CDN response status={response.status} content_length={length}")
        except Exception as error:
            last_error = error
        if attempt < CDN_VERIFY_RETRIES:
            sleep(3 * attempt)
    raise RuntimeError(f"CDN verification failed for {key}: {type(last_error).__name__}") from last_error


def publish_resources(client: object, bucket: str, root: Path, assets: list[Path], manifest: Path, *, publish_manifest: bool, cdn_base_url: str, verify_cdn_fn: Callable[[str, str], None] = verify_cdn) -> None:
    # The manifest advances only after every changed resource is available through COS and CDN.
    for item in assets:
        upload_or_reuse_object(client, bucket, key_for(root, item), item)
    for item in assets:
        verify_cos_size(client, bucket, key_for(root, item), item)
    for item in assets:
        verify_cdn_fn(key_for(root, item), cdn_base_url)
    if not publish_manifest:
        return
    upload_or_reuse_object(client, bucket, key_for(root, manifest), manifest)
    verify_cos_size(client, bucket, key_for(root, manifest), manifest)
    verify_cdn_fn(key_for(root, manifest), cdn_base_url)
    log("published manifests/remote-asset-manifest-v1.json")


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
    client = CosS3Client(config)
    manifest = root / "manifests/remote-asset-manifest-v1.json"
    assets = [item for item in changed if item != manifest]
    publish_resources(client, required("TENCENT_COS_BUCKET"), root, assets, manifest, publish_manifest=args.publish_manifest, cdn_base_url=args.cdn_base_url)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        log(f"COS publish failed: {error}")
        raise SystemExit(1)

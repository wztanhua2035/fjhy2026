from __future__ import annotations

import importlib.util
import io
import hashlib
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("cos_publish_assets", Path(__file__).parents[1] / "tools" / "cos_publish_assets.py")
assert SPEC and SPEC.loader
publisher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publisher)

class FakeCos:
    def __init__(self, failures: int = 0) -> None:
        self.failures = failures
        self.events: list[str] = []
        self.objects: dict[str, bytes] = {}
        self.multipart_part_size: int | None = None
    def put_object(self, *, Bucket: str, Key: str, Body: io.BufferedReader, EnableMD5: bool) -> None:
        self.events.append(f"put:{Key}")
        if self.failures:
            self.failures -= 1
            raise UploadError()
        self.objects[Key] = Body.read()
    def upload_file(self, *, Bucket: str, Key: str, LocalFilePath: str, PartSize: int, EnableMD5: bool) -> None:
        self.events.append(f"multipart:{Key}")
        self.multipart_part_size = PartSize
        self.objects[Key] = Path(LocalFilePath).read_bytes()
    def head_object(self, *, Bucket: str, Key: str) -> dict[str, object]:
        self.events.append(f"head:{Key}")
        payload = self.objects[Key]
        return {"Content-Length": str(len(payload)), "ETag": f'"{hashlib.md5(payload).hexdigest()}"'}

class UploadError(Exception):
    def get_error_code(self) -> str: return "TransientUploadFailure"
    def get_request_id(self) -> str: return "request-123"

class CosPublishAssetsTests(unittest.TestCase):
    def write(self, root: Path, path: str, content: bytes) -> Path:
        item = root / path
        item.parent.mkdir(parents=True, exist_ok=True)
        item.write_bytes(content)
        return item
    def test_small_png_uses_simple_put_and_head_size_check(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            item = self.write(Path(directory), "world/test.png", b"x" * (2 * 1024 * 1024))
            client = FakeCos()
            publisher.upload_object(client, "bucket", "world/test.png", item, sleep=lambda _: None)
            publisher.verify_cos_size(client, "bucket", "world/test.png", item)
            self.assertEqual(client.events, ["put:world/test.png", "head:world/test.png"])

    def test_head_content_length_accepts_both_sdk_spellings(self) -> None:
        self.assertEqual(publisher.content_length_from_head({"Content-Length": "12"}), 12)
        self.assertEqual(publisher.content_length_from_head({"ContentLength": 34}), 34)

    def test_head_without_length_has_safe_diagnostic(self) -> None:
        with self.assertRaisesRegex(RuntimeError, r"COS HEAD missing content length; fields=\[ETag\]"):
            publisher.content_length_from_head({"ETag": "abc"})
    def test_only_large_files_use_multipart_with_eight_mebibyte_parts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            item = self.write(Path(directory), "audio/large.ogg", b"x")
            class LargePath(type(item)):
                def stat(self): return type("Stat", (), {"st_size": publisher.SIMPLE_UPLOAD_LIMIT_BYTES + 1})()
            client = FakeCos()
            publisher.upload_object(client, "bucket", "audio/large.ogg", LargePath(item), sleep=lambda _: None)
            self.assertEqual(client.events, ["multipart:audio/large.ogg"])
            self.assertEqual(client.multipart_part_size, 8 * 1024 * 1024)
    def test_simple_put_retries_with_bounded_backoff(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            item = self.write(Path(directory), "world/retry.png", b"asset")
            client = FakeCos(failures=2); delays: list[float] = []
            publisher.upload_object(client, "bucket", "world/retry.png", item, sleep=delays.append)
            self.assertEqual(client.events, ["put:world/retry.png"] * 3)
            self.assertEqual(delays, [1, 3])
    def test_cdn_failure_does_not_publish_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); asset = self.write(root, "world/test.png", b"asset")
            manifest = self.write(root, "manifests/remote-asset-manifest-v1.json", b"manifest"); client = FakeCos()
            def cdn_fail(*_: str) -> None: raise RuntimeError("cdn unavailable")
            with self.assertRaisesRegex(RuntimeError, "cdn unavailable"):
                publisher.publish_resources(client, "bucket", root, [asset], manifest, publish_manifest=True, cdn_base_url="https://cdn.test", verify_cdn_fn=cdn_fail)
            self.assertNotIn("put:manifests/remote-asset-manifest-v1.json", client.events)

    def test_matching_size_and_etag_reuses_existing_resource(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            item = self.write(Path(directory), "world/test.png", b"asset")
            client = FakeCos()
            client.objects["world/test.png"] = b"asset"
            publisher.upload_or_reuse_object(client, "bucket", "world/test.png", item)
            self.assertEqual(client.events, ["head:world/test.png"])

    def test_size_or_etag_mismatch_reuploads_resource(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            item = self.write(Path(directory), "world/test.png", b"new-asset")
            client = FakeCos()
            client.objects["world/test.png"] = b"old-asset"
            publisher.upload_or_reuse_object(client, "bucket", "world/test.png", item)
            self.assertEqual(client.events, ["head:world/test.png", "put:world/test.png"])
    def test_manifest_is_uploaded_only_after_resource_cos_and_cdn_checks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); asset = self.write(root, "world/test.png", b"asset")
            manifest = self.write(root, "manifests/remote-asset-manifest-v1.json", b"manifest"); client = FakeCos(); cdn_events: list[str] = []
            publisher.publish_resources(client, "bucket", root, [asset], manifest, publish_manifest=True, cdn_base_url="https://cdn.test", verify_cdn_fn=lambda key, _: cdn_events.append(key))
            self.assertEqual(client.events, ["head:world/test.png", "put:world/test.png", "head:world/test.png", "head:manifests/remote-asset-manifest-v1.json", "put:manifests/remote-asset-manifest-v1.json", "head:manifests/remote-asset-manifest-v1.json"])
            self.assertEqual(cdn_events, ["world/test.png", "manifests/remote-asset-manifest-v1.json"])
    def test_error_diagnostics_do_not_render_exception_text(self) -> None:
        class SensitiveError(Exception):
            def __str__(self) -> str: return "secret-key-should-not-appear"
        self.assertNotIn("secret-key-should-not-appear", publisher.error_details(SensitiveError()))

if __name__ == "__main__": unittest.main()

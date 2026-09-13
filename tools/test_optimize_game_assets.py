"""Release guards for the first versioned Baishi runtime images."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path("assets/remote")
SPEC = importlib.util.spec_from_file_location("asset_optimizer", Path(__file__).with_name("optimize-game-assets.py"))
assert SPEC and SPEC.loader
optimizer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(optimizer)


class RuntimeImageTests(unittest.TestCase):
    def test_backgrounds_keep_exact_geometry_and_alpha(self):
        for name in ("salon", "grocery", "trade", "cloth", "inn", "guest-room"):
            base = ROOT / "world/baishi/interiors" / name
            old_version, new_version = (2, 3) if name == "guest-room" else (1, 2)
            with self.subTest(name=name), Image.open(base / f"background_v{old_version}.png") as source, Image.open(base / f"background_v{new_version}.png") as runtime:
                source.load(); runtime.load()
                self.assertEqual(source.size, runtime.size)
                self.assertIsNone(ImageChops.difference(source.getchannel("A"), runtime.getchannel("A")).getbbox())
                self.assertGreaterEqual(optimizer.psnr(source, runtime), 40.0)
                self.assertLess((base / f"background_v{new_version}.png").stat().st_size, 700 * 1024)

    def test_signs_are_clear_at_over_twice_runtime_display_width(self):
        for name in ("salon", "grocery", "trade", "cloth", "inn"):
            base = ROOT / "signs/baishi" / name
            with self.subTest(name=name), Image.open(base / "sign_v2.png") as image:
                image.load()
                self.assertEqual(image.width, 384)
                self.assertEqual(image.mode, "RGBA")
                self.assertLess((base / "sign_v2.png").stat().st_size, 150 * 1024)
                self.assertLess((base / "sign_v2.png").stat().st_size, (base / "sign_v1.png").stat().st_size)

    def test_optimizer_will_not_overwrite_existing_version(self):
        source = ROOT / "world/baishi/interiors/salon/background_v1.png"
        target = ROOT / "world/baishi/interiors/salon/background_v2.png"
        with self.assertRaisesRegex(ValueError, "unused versioned filename"):
            optimizer.optimize(source, target, "interior-background")


if __name__ == "__main__":
    unittest.main()

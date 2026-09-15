# Legacy Web fallback archive

2026-09-15: moved unchanged from `apps/admin/public/scene-layers/baishi/interiors/`.
These 14 files are historical art references, not Web/WeChat runtime assets or publishing sources.
Do not copy them back into `public` or use them to populate a new remote version.

- interior_salon_v1.png / interior_salon_fg_v1.png
- interior_grocery_v1.png / interior_grocery_fg_v1.png
- interior_trade_v1.png / interior_trade_fg_v1.png
- interior_cloth_v1.png / interior_cloth_fg_v1.png
- interior_inn_v1.png / interior_inn_fg_v1.png
- interior_guest_room_v1.png / interior_guest_room_fg_v1.png
- interior_guest_room_v2.png / interior_guest_room_fg_v2.png

Current sources are under `assets/remote/`; the release manifest identifies the exact version and SHA-256.
Rollback requires an explicit reviewed manifest version change. CDN failures use generic art, never these files.
Existing versioned resources in `assets/remote` and COS are retained.

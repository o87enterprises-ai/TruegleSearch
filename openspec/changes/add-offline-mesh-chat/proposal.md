# Change: Add Offline Mesh Chat ("Nearby") to the Android app

## Why
When cellular/internet is down, Truegle's offline hub (`/offline`) offers the guide, games, map and
lists — but no way to reach other people. A Bluetooth Low Energy (BLE) nearby-chat lets people with
the Truegle Android app message each other with no infrastructure, no server, and no tracking, which
fits the "no tracking / $0 / works offline" mission.

Source: the "SHTF.net" build manifest (React Native). That design is sound on the radio/crypto side
but assumes a separate native app. Truegle already ships a Capacitor Android shell
(`apps/android`), so we adopt its **constraints and protocol ideas** and build them inside the
existing shell instead of a second codebase.

## What Changes
- New **"Nearby" card** on `/offline` (OfflineHub), shown **only inside the native Android app**
  (Capacitor `isNativePlatform()`); hidden on web/PWA/iOS, which cannot do BLE peripheral/advertising.
- New native Capacitor plugin `TruegleMesh` (in `apps/android`) exposing BLE scan, advertise
  (peripheral role), GATT connect, read/write/notify, plus a connected-device foreground service.
  Based on `@capacitor-community/bluetooth-le` for the central role; peripheral/advertising and the
  foreground service are custom Kotlin (that library has no peripheral role).
- New frontend mesh module (`apps/frontend/src/mesh/`): envelope, dedup LRU, TTL/hop limit,
  store-and-forward queue (IndexedDB), identity, Noise session, chat UI.
- Crypto: Noise XX (X25519 / ChaCha20-Poly1305 / SHA-256) using a **pure-JS** implementation
  (`@stablelib/*`), Ed25519 identity. **No libsodium / `sodium-universal`.** Identity private key
  kept in Android Keystore via the plugin, never in IndexedDB/localStorage.
- Phased: **MVP = discovery + direct encrypted 1:1 and broadcast chat**. Multi-hop relay is Phase 2;
  Wi-Fi Direct bulk transfer is out of scope.
- Docs: `docs/OFFLINE-MESH.md` (profiles, permissions, physical-device test procedure).

## Non-goals
- iOS (no BLE peripheral from a Capacitor/web layer; Apple needs a native build — separate proposal).
- Web/PWA support (Web Bluetooth has no advertising and no background).
- Wi-Fi Direct, LoRa bridge, Multipeer, any server/relay, accounts, analytics on mesh traffic.
- Replacing the React Native manifest as written.

## Constraints carried over from the manifest
1. BLE GATT is the only transport; every feature works over BLE alone.
2. Radio features are verified on **physical devices only** (no emulator).
3. Android 12+: runtime `BLUETOOTH_SCAN/CONNECT/ADVERTISE` + foreground service type `connectedDevice`;
   start the service while the app is foregrounded.
4. E2E encryption before anything reaches the routing layer; relays see ciphertext only.
5. Max ~7 simultaneous GATT connections.
6. Build toolchain: the Android README says JDK 21; the manifest says JDK 17 for `react-native-ble-plx`.
   The Capacitor plugin does not use ble-plx — **verify the JDK in `apps/android` build before pinning**.

## Impact
- Affected specs: new capability `offline-mesh` (no existing spec).
- Affected code: `apps/android/` (plugin, manifest permissions, workflow), `apps/frontend/src/pages/OfflineHub.jsx`,
  new `apps/frontend/src/mesh/`, `docs/`.
- Privacy/Policy: no network calls, no third-party SDKs, no tracking; consistent with `docs/AD-POLICY.md`
  and the zero-cookie stance. Adds Bluetooth/location permissions to the APK only (not the website).
- Cost: $0 (no new services). Both-backend rule unaffected (no backend change).
- Risk: BLE peripheral behavior varies by OEM; battery drain; Play/F-Droid permission review.
  Mitigation: duty-cycle scanning, opt-in toggle, physical-device test matrix.

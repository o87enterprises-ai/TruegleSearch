## 1. Feasibility spike (gate: 2 physical Android phones)
- [ ] 1.1 Confirm JDK/AGP/Gradle versions `apps/android` builds with; add `@capacitor-community/bluetooth-le`
- [ ] 1.2 Kotlin plugin `TruegleMesh`: advertise service UUID + 8-byte fingerprint, GATT server with one RX/TX characteristic
- [ ] 1.3 Two phones discover each other and exchange raw bytes in < 5 s of foregrounding

## 2. Android permissions and service
- [ ] 2.1 Manifest: BLUETOOTH_SCAN (neverForLocation), CONNECT, ADVERTISE, legacy BT (maxSdk 30), FINE_LOCATION, FOREGROUND_SERVICE(+CONNECTED_DEVICE)
- [ ] 2.2 Runtime permission flow; foreground service started only from foreground
- [ ] 2.3 No INTERNET-dependent code paths in the plugin

## 3. Mesh core (`apps/frontend/src/mesh/`)
- [ ] 3.1 `envelope.js` (messageId, origin, dest|broadcast, ttl, hop, maxHops, createdAt) + profiles (Standard 8/24h, Emergency 8/6h)
- [ ] 3.2 `dedup.js` bounded LRU (1000), `queue.js` store-and-forward in IndexedDB
- [ ] 3.3 Unit tests: dedup, TTL expiry, hop limit, no relay loop (Vitest, runs without a radio)

## 4. Identity and encryption
- [ ] 4.1 Ed25519 identity; private key in Android Keystore via plugin; fingerprint = SHA-256(pub)[0..16]
- [ ] 4.2 Noise XX over `@stablelib` (pure JS); rekey at 1000 msgs / 24 h
- [ ] 4.3 QR fingerprint verification; trust states (unverified / verified / blocked)
- [ ] 4.4 Test: packet capture / byte inspection shows ciphertext only

## 5. UI
- [ ] 5.1 "Nearby" card on OfflineHub, native-only (`Capacitor.isNativePlatform()`), explainer + opt-in toggle
- [ ] 5.2 Peer list, chat screen with queued/sent/delivered status, emergency broadcast button
- [ ] 5.3 Settings: display name, profile, battery-saver (reduced scan duty cycle)

## 6. Phase 2 (separate approval)
- [ ] 6.1 Multi-hop relay A→B→C on 3 phones; relay count and duplicate suppression verified

## 7. Docs and release
- [ ] 7.1 `docs/OFFLINE-MESH.md` (profiles, permissions, device test procedure)
- [ ] 7.2 `npm run check:ads` and privacy review pass; APK built via the existing "Android APK" workflow
- [ ] 7.3 Add open thread + decision to `.claude/memory` and HANDOFF

## ADDED Requirements

### Requirement: Native-only availability
The Nearby mesh chat SHALL be offered only in the Truegle Android app and SHALL NOT appear on web, PWA, or unsupported platforms.

#### Scenario: Web visitor
- **WHEN** `/offline` is opened in a browser
- **THEN** no Nearby card is shown
- **AND** `/nearby` (also in the hamburger menu) shows the how-it-works guide with the controls disabled

### Requirement: Messenger-style conversations
Nearby SHALL support multiple saved conversations (1:1 and small groups), per-message delivery status, queued delivery to devices that are out of range, typing indicators, and saved-device management (rename, refresh, delete).

#### Scenario: Out of range
- **WHEN** a message is sent to a device that is out of range
- **THEN** it is queued on the sender's phone and delivered automatically when the device is next in range

#### Scenario: Android app
- **WHEN** `/offline` is opened in the Android app
- **THEN** a Nearby card is shown that explains the feature before any permission is requested

### Requirement: Opt-in radio use
The app SHALL NOT scan or advertise over Bluetooth until the user turns Nearby on, and SHALL stop when the user turns it off.

#### Scenario: Default state
- **WHEN** the app is installed and opened
- **THEN** no Bluetooth scanning or advertising occurs

### Requirement: Peer discovery over BLE
With Nearby on, the app SHALL discover other Truegle Nearby devices over BLE and list each with its short fingerprint.

#### Scenario: Two phones in range
- **WHEN** two phones both have Nearby on and are foregrounded in range
- **THEN** each appears in the other's peer list within 5 seconds

### Requirement: End-to-end encryption
Message payloads SHALL be encrypted with a Noise XX session before being handed to routing or transport, so any relaying device sees only ciphertext.

#### Scenario: Observed traffic
- **WHEN** BLE traffic between two paired phones is inspected
- **THEN** no plaintext message content is present

### Requirement: Bounded store-and-forward (Phase 2)
Relayed messages SHALL carry a message id, hop count, max hops and TTL; a device SHALL drop duplicates, expired messages, and messages at max hops.

#### Scenario: Duplicate
- **WHEN** a device receives a message id it has already seen
- **THEN** it does not display or forward it again

### Requirement: No tracking
Mesh traffic, identities and fingerprints SHALL NOT be sent to any server, analytics service or third party, and SHALL be stored only on the device.

#### Scenario: Network inspection
- **WHEN** Nearby is used with the device in airplane mode plus Bluetooth
- **THEN** the feature works fully and makes no network requests

package info.truegle.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Phase-1 spike of the Offline Mesh ("Nearby") feature — see openspec/changes/add-offline-mesh-chat.
 *
 * BLE only, no network, no third-party SDK. Each phone runs a GATT server (one write-only RX
 * characteristic) and advertises the Truegle service UUID plus an 8-byte random fingerprint in the
 * scan response, while scanning for the same UUID. To send, we connect to the peer as a GATT client
 * and write the bytes to its RX characteristic. Bytes in/out are opaque; encryption is a later phase.
 */
@CapacitorPlugin(
    name = "TruegleMesh",
    permissions = {
        @Permission(alias = "ble31", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE
        }),
        @Permission(alias = "bleLegacy", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
@SuppressLint("MissingPermission") // every entry point is gated by hasPerms()
public class TruegleMeshPlugin extends Plugin {
    static final UUID SERVICE_UUID = UUID.fromString("7a3f0001-5e8c-4b1a-9d3e-7472756c6531");
    static final UUID RX_UUID = UUID.fromString("7a3f0002-5e8c-4b1a-9d3e-7472756c6531");
    static final int COMPANY_ID = 0xFFFF; // "reserved for testing"; only our UUID filter is trusted
    static final int MAX_PAYLOAD = 180;

    private BluetoothManager manager;
    private BluetoothAdapter adapter;
    private BluetoothGattServer gattServer;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothLeScanner scanner;
    private boolean running = false;
    private byte[] fingerprint;
    // fingerprint hex -> last seen address
    private final Map<String, String> peers = Collections.synchronizedMap(new HashMap<>());

    private boolean isSupported() {
        Context c = getContext();
        return c.getPackageManager().hasSystemFeature("android.hardware.bluetooth_le");
    }

    private String permAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "ble31" : "bleLegacy";
    }

    private boolean hasPerms() {
        return getPermissionState(permAlias()) == com.getcapacitor.PermissionState.GRANTED;
    }

    private byte[] loadFingerprint() {
        SharedPreferences sp = getContext().getSharedPreferences("truegle_mesh", Context.MODE_PRIVATE);
        String saved = sp.getString("fp", null);
        if (saved != null) return Base64.decode(saved, Base64.NO_WRAP);
        byte[] fp = new byte[8];
        new SecureRandom().nextBytes(fp);
        sp.edit().putString("fp", Base64.encodeToString(fp, Base64.NO_WRAP)).apply();
        return fp;
    }

    private static String hex(byte[] b) {
        StringBuilder s = new StringBuilder();
        for (byte x : b) s.append(String.format("%02x", x));
        return s.toString();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject o = new JSObject();
        o.put("supported", isSupported());
        o.put("granted", isSupported() && hasPerms());
        o.put("running", running);
        BluetoothManager m = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter a = m != null ? m.getAdapter() : null;
        o.put("bluetoothOn", a != null && a.isEnabled());
        o.put("advertiseSupported", a != null && a.isMultipleAdvertisementSupported());
        o.put("model", Build.MODEL); // default display name
        // Android 11 and older only let apps scan for Bluetooth devices while Location is switched on.
        boolean locationNeeded = false;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            android.location.LocationManager lm = (android.location.LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            locationNeeded = lm != null && !(Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? lm.isLocationEnabled()
                : lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER));
        }
        o.put("locationNeeded", locationNeeded);
        o.put("sdk", Build.VERSION.SDK_INT);
        if (fingerprint == null && isSupported()) fingerprint = loadFingerprint();
        if (fingerprint != null) o.put("fingerprint", hex(fingerprint));
        call.resolve(o);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!isSupported()) { call.reject("BLE not supported on this device"); return; }
        if (!hasPerms()) {
            requestPermissionForAlias(permAlias(), call, "permsCallback");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void permsCallback(PluginCall call) {
        if (!hasPerms()) { call.reject("Bluetooth permission denied"); return; }
        doStart(call);
    }

    private void doStart(PluginCall call) {
        manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = manager != null ? manager.getAdapter() : null;
        if (adapter == null || !adapter.isEnabled()) { call.reject("Turn Bluetooth on"); return; }
        if (running) { call.resolve(); return; }
        fingerprint = loadFingerprint();

        gattServer = manager.openGattServer(getContext(), serverCallback);
        if (gattServer == null) { call.reject("Could not open GATT server"); return; }
        BluetoothGattService svc = new BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        BluetoothGattCharacteristic rx = new BluetoothGattCharacteristic(
            RX_UUID,
            BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
            BluetoothGattCharacteristic.PERMISSION_WRITE);
        svc.addCharacteristic(rx);
        gattServer.addService(svc);

        advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser != null) {
            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
                .setConnectable(true)
                .build();
            AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addServiceUuid(new ParcelUuid(SERVICE_UUID))
                .build();
            AdvertiseData scanResp = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addManufacturerData(COMPANY_ID, fingerprint)
                .build();
            advertiser.startAdvertising(settings, data, scanResp, advCallback);
        }

        scanner = adapter.getBluetoothLeScanner();
        if (scanner != null) {
            ScanFilter filter = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE_UUID)).build();
            ScanSettings ss = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
            scanner.startScan(Arrays.asList(filter), ss, scanCallback);
        }
        running = true;
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        doStop();
        call.resolve();
    }

    private void doStop() {
        try { if (scanner != null) scanner.stopScan(scanCallback); } catch (Exception ignored) {}
        try { if (advertiser != null) advertiser.stopAdvertising(advCallback); } catch (Exception ignored) {}
        try { if (gattServer != null) gattServer.close(); } catch (Exception ignored) {}
        scanner = null; advertiser = null; gattServer = null;
        peers.clear();
        running = false;
    }

    @Override
    protected void handleOnDestroy() {
        if (hasPermsSafe()) doStop();
    }

    private boolean hasPermsSafe() {
        try { return hasPerms(); } catch (Exception e) { return false; }
    }

    /** send({ peer: <fingerprint hex>, data: <base64> }) -> resolves once the peer acknowledged the write. */
    @PluginMethod
    public void send(PluginCall call) {
        if (!running || !hasPerms()) { call.reject("Nearby is off"); return; }
        String peer = call.getString("peer");
        if (peer == null) { call.reject("peer required"); return; }
        String address = peers.get(peer);
        if (address == null) { call.reject("Peer not in range"); return; }
        // One packet in "data", or several in "chunks" (written in order over a single connection).
        final java.util.List<byte[]> packets = new java.util.ArrayList<>();
        try {
            JSArray chunks = call.getArray("chunks");
            if (chunks != null) {
                for (int i = 0; i < chunks.length(); i++) packets.add(Base64.decode(chunks.getString(i), Base64.NO_WRAP));
            } else {
                String b64 = call.getString("data");
                if (b64 == null) { call.reject("data required"); return; }
                packets.add(Base64.decode(b64, Base64.NO_WRAP));
            }
        } catch (Exception e) { call.reject("Bad data"); return; }
        if (packets.isEmpty() || packets.size() > 200) { call.reject("1-200 packets"); return; }
        for (byte[] p : packets) {
            if (p.length == 0 || p.length > MAX_PAYLOAD) { call.reject("Each packet must be 1-" + MAX_PAYLOAD + " bytes"); return; }
        }

        BluetoothDevice dev = adapter.getRemoteDevice(address);
        call.setKeepAlive(true);
        dev.connectGatt(getContext(), false, new ClientCallback(call, packets), BluetoothDevice.TRANSPORT_LE);
    }

    // ---- client: connect, write once, disconnect ----
    private static class ClientCallback extends BluetoothGattCallback {
        private final PluginCall call;
        private final java.util.List<byte[]> packets;
        private int next = 0;
        private boolean done = false;

        ClientCallback(PluginCall call, java.util.List<byte[]> packets) { this.call = call; this.packets = packets; }

        private void writeNext(BluetoothGatt gatt, BluetoothGattCharacteristic c) {
            c.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
            c.setValue(packets.get(next));
            if (!gatt.writeCharacteristic(c)) finish(gatt, "Write rejected");
        }

        private void finish(BluetoothGatt gatt, String err) {
            if (done) return;
            done = true;
            try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {}
            if (err == null) call.resolve(); else call.reject(err);
        }

        private boolean discovering = false;

        private synchronized void discover(BluetoothGatt gatt) {
            if (discovering || done) return;
            discovering = true;
            gatt.discoverServices();
        }

        // Default ATT MTU is 23 (20 usable bytes). Our packets are up to 180, so ask for a bigger
        // MTU first; without it Android falls back to "long writes" the server must special-case.
        @Override public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) { discover(gatt); }

        @Override public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                Handler h = new Handler(Looper.getMainLooper());
                // A short pause avoids flaky GATT errors on some phones.
                h.postDelayed(() -> { if (!gatt.requestMtu(247)) discover(gatt); }, 400);
                h.postDelayed(() -> discover(gatt), 3000); // in case the MTU callback never comes
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                finish(gatt, "Connection failed (" + status + ")");
            }
        }

        @Override public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            BluetoothGattService s = gatt.getService(SERVICE_UUID);
            BluetoothGattCharacteristic c = s != null ? s.getCharacteristic(RX_UUID) : null;
            if (c == null) { finish(gatt, "Peer is not running Truegle Nearby"); return; }
            writeNext(gatt, c);
        }

        @Override public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic c, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) { finish(gatt, "Write failed (" + status + ")"); return; }
            next++;
            if (next >= packets.size()) finish(gatt, null); else writeNext(gatt, c);
        }
    }

    // ---- server: receive writes ----
    private final Map<String, ByteArrayOutputStream> pending = Collections.synchronizedMap(new HashMap<>());

    private final BluetoothGattServerCallback serverCallback = new BluetoothGattServerCallback() {
        @Override
        public void onExecuteWrite(BluetoothDevice device, int requestId, boolean execute) {
            ByteArrayOutputStream buf = pending.remove(device.getAddress());
            boolean ok = execute && buf != null && buf.size() > 0;
            if (gattServer != null) {
                gattServer.sendResponse(device, requestId, ok || !execute ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_FAILURE, 0, null);
            }
            if (ok) {
                JSObject o = new JSObject();
                o.put("address", device.getAddress());
                o.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
                notifyListeners("data", o);
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                BluetoothGattCharacteristic c, boolean preparedWrite, boolean responseNeeded,
                int offset, byte[] value) {
            if (preparedWrite) { // a "long write": collect the pieces, deliver on execute
                ByteArrayOutputStream buf = pending.get(device.getAddress());
                if (buf == null) { buf = new ByteArrayOutputStream(); pending.put(device.getAddress(), buf); }
                boolean fits = RX_UUID.equals(c.getUuid()) && value != null && offset == buf.size() && buf.size() + value.length <= MAX_PAYLOAD;
                if (fits) buf.write(value, 0, value.length); else pending.remove(device.getAddress());
                if (responseNeeded && gattServer != null) {
                    gattServer.sendResponse(device, requestId,
                        fits ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_INVALID_OFFSET, offset, fits ? value : null);
                }
                return;
            }
            boolean ok = RX_UUID.equals(c.getUuid()) && offset == 0
                && value != null && value.length > 0 && value.length <= MAX_PAYLOAD;
            if (responseNeeded && gattServer != null) {
                gattServer.sendResponse(device, requestId,
                    ok ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null);
            }
            if (ok) {
                JSObject o = new JSObject();
                o.put("address", device.getAddress());
                o.put("data", Base64.encodeToString(value, Base64.NO_WRAP));
                notifyListeners("data", o);
            }
        }
    };

    // ---- scan / advertise ----
    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int type, ScanResult r) {
            if (r.getScanRecord() == null) return;
            byte[] fp = r.getScanRecord().getManufacturerSpecificData(COMPANY_ID);
            if (fp == null || fp.length != 8) return;
            String id = hex(fp);
            if (fingerprint != null && id.equals(hex(fingerprint))) return; // ourselves
            peers.put(id, r.getDevice().getAddress());
            JSObject o = new JSObject();
            o.put("peer", id);
            o.put("rssi", r.getRssi());
            notifyListeners("peer", o);
        }
        @Override public void onScanFailed(int errorCode) {
            JSObject o = new JSObject();
            o.put("error", "scan failed " + errorCode);
            notifyListeners("error", o);
        }
    };

    private final AdvertiseCallback advCallback = new AdvertiseCallback() {
        @Override public void onStartFailure(int errorCode) {
            JSObject o = new JSObject();
            o.put("error", "advertise failed " + errorCode);
            notifyListeners("error", o);
        }
    };
}

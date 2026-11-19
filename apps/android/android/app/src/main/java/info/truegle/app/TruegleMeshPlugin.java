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
        String b64 = call.getString("data");
        if (peer == null || b64 == null) { call.reject("peer and data required"); return; }
        String address = peers.get(peer);
        if (address == null) { call.reject("Peer not in range"); return; }
        final byte[] payload;
        try { payload = Base64.decode(b64, Base64.NO_WRAP); } catch (Exception e) { call.reject("Bad data"); return; }
        if (payload.length == 0 || payload.length > MAX_PAYLOAD) { call.reject("Payload must be 1-" + MAX_PAYLOAD + " bytes"); return; }

        BluetoothDevice dev = adapter.getRemoteDevice(address);
        call.setKeepAlive(true);
        dev.connectGatt(getContext(), false, new ClientCallback(call, payload), BluetoothDevice.TRANSPORT_LE);
    }

    // ---- client: connect, write once, disconnect ----
    private static class ClientCallback extends BluetoothGattCallback {
        private final PluginCall call;
        private final byte[] payload;
        private boolean done = false;

        ClientCallback(PluginCall call, byte[] payload) { this.call = call; this.payload = payload; }

        private void finish(BluetoothGatt gatt, String err) {
            if (done) return;
            done = true;
            try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {}
            if (err == null) call.resolve(); else call.reject(err);
        }

        @Override public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                gatt.discoverServices();
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                finish(gatt, "Connection failed (" + status + ")");
            }
        }

        @Override public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            BluetoothGattService s = gatt.getService(SERVICE_UUID);
            BluetoothGattCharacteristic c = s != null ? s.getCharacteristic(RX_UUID) : null;
            if (c == null) { finish(gatt, "Peer is not running Truegle Nearby"); return; }
            c.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
            c.setValue(payload);
            if (!gatt.writeCharacteristic(c)) finish(gatt, "Write rejected");
        }

        @Override public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic c, int status) {
            finish(gatt, status == BluetoothGatt.GATT_SUCCESS ? null : "Write failed (" + status + ")");
        }
    }

    // ---- server: receive writes ----
    private final BluetoothGattServerCallback serverCallback = new BluetoothGattServerCallback() {
        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                BluetoothGattCharacteristic c, boolean preparedWrite, boolean responseNeeded,
                int offset, byte[] value) {
            boolean ok = RX_UUID.equals(c.getUuid()) && !preparedWrite && offset == 0
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

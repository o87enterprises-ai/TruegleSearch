import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, WifiOff, Wifi, Users } from 'lucide-react';
import TruegleLogo from '../components/ui/TruegleLogo';
import ApkDownload from '../components/ui/ApkDownload';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import useNearby from '../mesh/useNearby';
import HandleCard from '../mesh/HandleCard';
import {
  PowerSwitch, ChatBar, GuideModal, GuideContent, Collapsible, DeviceList, ConversationHeader,
  MessageCards, TypingIndicator, Toasts,
} from '../mesh/NearbyUI';
import { startRecording, canRecord, MAX_VOICE_MS } from '../mesh/voice';
import { getHideGuide, saveHideGuide, getOfflineSince, saveOfflineSince, maxTextBytes, fitText, dmId } from '../mesh/store';

// How long this device has been without internet. Counts from the moment the connection
// dropped, and survives leaving and reopening the page.
function useOfflineClock() {
  const online = useOnlineStatus();
  const [since, setSince] = useState(() => (typeof navigator !== 'undefined' && !navigator.onLine ? (getOfflineSince() ?? Date.now()) : null));
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    if (online) { saveOfflineSince(null); setSince(null); return; }
    const s = getOfflineSince() ?? Date.now();
    saveOfflineSince(s); setSince(s);
  }, [online]);
  useEffect(() => {
    if (online) return undefined;
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, [online]);
  if (online || !since) return { online: true, text: 'Online' };
  const s = Math.max(0, Math.floor((t - since) / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return { online: false, text: `Offline ${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` };
}

// /nearby — message phones around you over Bluetooth, no internet. Native Android app only;
// on the web this page just explains it.
// Flow: turn on -> pick device(s) -> type in the box -> the conversation plays in below.
export default function NearbyPage() {
  const n = useNearby();
  const clock = useOfflineClock();
  const [text, setText] = useState('');
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hide, setHide] = useState(getHideGuide);
  const [toasts, setToasts] = useState([]);
  const retract = useRef(null);

  // Switching on: instructions pop up and the devices list drops down.
  const wasOn = useRef(false);
  useEffect(() => {
    if (n.on && !wasOn.current) { setDevicesOpen(true); if (!getHideGuide()) setGuideOpen(true); }
    if (!n.on) { setDevicesOpen(false); clearTimeout(retract.current); }
    wasOn.current = n.on;
  }, [n.on]);

  // "Connected to …" pop-ups, like a Bluetooth connection.
  const prevNear = useRef(new Set());
  useEffect(() => {
    const cur = new Set(Object.keys(n.live).filter(n.isNear));
    const push = (kind, text) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-2), { id, kind, text }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    if (n.on) {
      cur.forEach((fp) => { if (!prevNear.current.has(fp)) push('up', `Connected to ${n.labelOf(fp)}`); });
      prevNear.current.forEach((fp) => { if (!cur.has(fp)) push('down', `${n.labelOf(fp)} is out of range`); });
    }
    prevNear.current = cur;
     
  }, [n.live, n.now, n.on]);

  // Opening a conversation marks it read.
  useEffect(() => { if (n.activeTid) n.markRead(n.activeTid);   }, [n.activeTid]);

  // One list: devices in range first (closest first), then saved devices that are out of range.
  const nearFps = Object.keys(n.live).filter(n.isNear).sort((a, b) => (n.live[b].rssi ?? -99) - (n.live[a].rssi ?? -99));
  const savedFps = Object.keys(n.contacts).filter((fp) => !nearFps.includes(fp)).sort((a, b) => (n.contacts[b].last || 0) - (n.contacts[a].last || 0));
  const rows = [...nearFps, ...savedFps].map((fp) => {
    const c = n.contacts[fp] || {};
    const msgs = n.chats[dmId(fp)] || [];
    return {
      fp, label: n.labelOf(fp), name: c.name, alias: c.alias, last: c.last, near: n.isNear(fp), rssi: n.live[fp]?.rssi,
      lastMsg: msgs[msgs.length - 1],
      waiting: n.outbox.filter((m) => m.to === fp).length,
      unread: Object.values(n.threads).some((t) => t.unread && t.members.includes(fp)),
    };
  });

  const groups = Object.values(n.threads).filter((t) => !t.id.startsWith('dm:') && t.members.length > 1).sort((a, b) => b.updated - a.updated);

  const onToggleSelect = (fp) => {
    n.toggleSelect(fp);
    clearTimeout(retract.current);
    retract.current = setTimeout(() => setDevicesOpen(false), 2500); // retract once you've picked
  };
  const done = () => { clearTimeout(retract.current); setDevicesOpen(false); };
  useEffect(() => () => clearTimeout(retract.current), []);

  // Voice notes: tap the mic, speak (up to 8 s), tap ■ to send. One device at a time.
  const [recorder, setRecorder] = useState(null);
  const [recMs, setRecMs] = useState(0);
  const [voiceErr, setVoiceErr] = useState('');
  const onMic = async () => {
    setVoiceErr('');
    if (recorder) { recorder.stop(); return; }
    try {
      const r = await startRecording(setRecMs);
      setRecorder(r);
      r.done.then((res) => { if (res && !n.sendVoice(res)) setVoiceErr('Select exactly one device for a voice note'); })
        .catch((e) => setVoiceErr(String(e?.message || e)))
        .finally(() => { setRecorder(null); setRecMs(0); });
    } catch (e) {
      setVoiceErr(e?.name === 'NotAllowedError' ? 'Microphone permission was denied' : String(e?.message || e));
    }
  };
  useEffect(() => () => recorder?.cancel(), [recorder]);
  const voice = {
    available: n.available && canRecord(), recording: !!recorder, ms: recMs, maxS: MAX_VOICE_MS / 1000, error: voiceErr,
    canVoice: n.selected.length === 1, onMic, onCancel: () => { recorder?.cancel(); },
  };

  const limit = maxTextBytes(n.name);
  const canSend = n.on && n.selected.length > 0;
  const send = () => { if (n.send(text)) setText(''); };
  const list = n.activeTid ? (n.chats[n.activeTid] || []) : [];
  const toNames = n.selected.map(n.labelOf).join(', ');
  const people = n.selected.map((fp) => ({ fp, label: n.labelOf(fp), near: n.isNear(fp), rssi: n.live[fp]?.rssi }));
  const nearCount = nearFps.length;

  return (
    <div className="min-h-screen bg-black text-white px-4 pt-16 pb-16">
      <Toasts items={toasts} />
      <div className="max-w-3xl mx-auto space-y-4">
        <Link to="/offline" className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white">
          <ArrowLeft size={14} /> Offline home
        </Link>

        <div className="flex justify-center"><TruegleLogo size="large" animated /></div>

        {/* Power switch (where the pill sits on search) + offline clock */}
        <div className="flex flex-col items-center gap-2">
          <PowerSwitch on={n.on} onChange={n.toggle} disabled={!n.available || !n.st?.supported} />
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${clock.online ? 'border-white/15 text-white/45' : 'border-amber-400/40 text-amber-300'}`}>
            {clock.online ? <Wifi size={12} /> : <WifiOff size={12} />} {clock.text}
          </span>
        </div>

        {!n.available && (
          <>
            <p className="text-center text-sm text-amber-300">Nearby works in the Truegle Android app. This page explains how it works.</p>
            <ApkDownload className="max-w-md mx-auto" />
          </>
        )}
        {n.st && !n.st.supported && <p className="text-center text-xs text-amber-300">This device has no Bluetooth LE.</p>}
        {n.st?.supported && !n.st.advertiseSupported && (
          <p className="text-center text-xs text-amber-300">This phone can’t advertise over Bluetooth, so others won’t see it (it can still see them).</p>
        )}
        {n.st?.locationNeeded && (
          <p className="text-center text-xs text-amber-300">Android 11 and older need Location turned on (Settings → Location) before Bluetooth can find nearby phones. Truegle doesn’t use or store your location.</p>
        )}
        {n.err && <p className="text-center text-xs text-red-300" role="alert">{n.err}</p>}

        {/* 1. Pick who to message (also your saved devices, history and name) */}
        <Collapsible open={devicesOpen && n.on} onToggle={() => n.on && setDevicesOpen((o) => !o)}
          title="1 · Available devices"
          badge={n.on ? `${nearCount} nearby · ${n.selected.length ? toNames : 'none selected'}` : 'turn Nearby on'}>
          <DeviceList rows={rows} selected={n.selected} onToggle={onToggleSelect} onDone={done}
            name={n.name} onName={n.rename} onRefreshAll={n.refreshAll} canRefresh={n.on}
            onRename={n.renameDevice} onRefresh={n.refreshDevice} onDelete={n.deleteDevice} sendErr={n.sendErr} />
        </Collapsible>

        {/* 2. Type in the box (it lights up once a device is selected) */}
        <ChatBar on={n.on} canSend={canSend} limit={limit} value={text} voice={voice}
          placeholder={!n.on ? 'Turn Nearby on to start' : n.selected.length ? `Message ${toNames}…` : 'Select a device above first'}
          onChange={(v) => { const t = fitText(v, limit); setText(t); if (t) n.notifyTyping(); }}
          onSend={send} />

        <p className="text-center text-xs text-white/45 -mt-1">
          Select a device, then type. Out of range? Your message waits and sends when they’re back.{' '}
          <button type="button" className="underline hover:text-white" onClick={() => setGuideOpen(true)}>How it works</button>
        </p>

        {/* 3. The live conversation */}
        {groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
            <Users size={12} /> Group chats:
            {groups.map((g) => (
              <button key={g.id} type="button" onClick={() => n.openThread(g.id)}
                className={`rounded-full border px-2.5 py-1 ${g.id === n.activeTid ? 'border-orange-400/70 text-orange-200' : 'border-white/15 hover:bg-white/5'}`}>
                {g.members.map(n.labelOf).join(', ')}{g.unread && ' •'}
              </button>
            ))}
          </div>
        )}

        {n.selected.length > 0 && (
          <section aria-label="Conversation" className="space-y-3">
            <ConversationHeader people={people} />
            {n.selected.some((fp) => n.sendErr[fp]) && (
              <p className="text-[11px] text-red-300/80">Retrying: {n.selected.map((fp) => n.sendErr[fp]).find(Boolean)}</p>
            )}
            <MessageCards key={n.activeTid || toNames} list={list} labelOf={n.labelOf} />
            <TypingIndicator names={n.typingNow} />
          </section>
        )}

        {clock.online && <HandleCard />}

        {!n.available && (
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><GuideContent /></section>
        )}
      </div>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} hide={hide}
        onHide={(v) => { setHide(v); saveHideGuide(v); }} />
    </div>
  );
}

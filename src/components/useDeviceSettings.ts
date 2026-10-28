import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceSettingsSnapshot, SettingChange } from '../domain/types';
import { readDeviceSettings, applyDeviceSetting } from '../services/bridge';
import { useGearStore } from '../store/useGearStore';
export function useDeviceSettings(deviceId: string, supported: boolean) {
  const incoming = useGearStore(s => s.readings[deviceId]), incomingError = useGearStore(s => s.readingErrors[deviceId]);
  const [snapshot, setSnapshot] = useState<DeviceSettingsSnapshot | null>(() => useGearStore.getState().readings[deviceId]?.snapshot ?? null);
  const [observedAt, setObservedAt] = useState(() => useGearStore.getState().readings[deviceId]?.at ?? 0);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const generation = useRef(0), locked = useRef(false);
  const remember = useCallback((value: DeviceSettingsSnapshot) => { setSnapshot(value); useGearStore.getState().setReading(value); setObservedAt(useGearStore.getState().readings[value.device_id].at); }, []);
  useEffect(() => {
    if (locked.current || !supported) return;
    if (incoming) { setSnapshot(incoming.snapshot); setObservedAt(incoming.at); setError(null); }
    else if (incomingError) { setSnapshot(null); setError(incomingError); }
  }, [incoming, incomingError, supported]);
  const reload = useCallback(async () => {
    if (!supported || locked.current) return;
    const run = ++generation.current; locked.current = true; setBusy(true); setError(null);
    try { const result = await readDeviceSettings(deviceId); if (run === generation.current) remember(result); }
    catch (e) { if (run === generation.current) { setError(String(e)); setSnapshot(null); useGearStore.getState().clearReading(deviceId, String(e)); } }
    finally { if (run === generation.current) { locked.current = false; setBusy(false); } }
  }, [deviceId, supported, remember]);
  useEffect(() => {
    const cached = useGearStore.getState().readings[deviceId];
    if (!supported) { setSnapshot(null); return; }
    if (cached && Date.now() - cached.at < 5000) { setSnapshot(cached.snapshot); } else { void reload(); }
    return () => { generation.current++; locked.current = false; };
  }, [deviceId, supported, reload]);
  const applyChanges = async (changes: SettingChange[]): Promise<boolean> => {
    if (!snapshot || locked.current || !supported) return false;
    if (!changes.length) { useGearStore.getState().notify('O dispositivo já está usando esses valores.'); return true; }
    const run = ++generation.current; locked.current = true; setBusy(true); setError(null);
    let current = snapshot;
    try {
      for (const change of changes) {
        if (run !== generation.current) return false;
        current = await applyDeviceSetting(deviceId, current.revision, change);
        if (run === generation.current) remember(current);
      }
      if (run !== generation.current) return false;
      useGearStore.getState().notify('Configuração confirmada pelo dispositivo.'); return true;
    } catch (e) {
      if (run === generation.current) {
        setError(`${String(e)}${changes.length > 1 ? ' A aplicação parou; alguns ajustes anteriores podem ter sido confirmados.' : ''}`);
        try { const actual = await readDeviceSettings(deviceId); if (run === generation.current) remember(actual); }
        catch { if (run === generation.current) { setSnapshot(null); useGearStore.getState().clearReading(deviceId, String(e)); } }
      }
      return false;
    } finally { if (run === generation.current) { locked.current = false; setBusy(false); } }
  };
  const apply = async (change: SettingChange) => { await applyChanges([change]); };
  return { snapshot, observedAt, busy, error, reload, apply, applyChanges };
}

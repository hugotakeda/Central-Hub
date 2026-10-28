import { useEffect, useId, useState } from 'react';
import type { AudioEndpoint } from '../domain/types';
import { useGearStore } from '../store/useGearStore';
export function AudioControls({ endpoint }: { endpoint: AudioEndpoint }) {
  const change = useGearStore(s => s.changeAudio);
  const volumeId = useId();
  const [volume, setVolume] = useState(endpoint.volume ?? 0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setVolume(endpoint.volume ?? 0); }, [endpoint.volume]);
  const apply = async (nextVolume: number | null, muted: boolean | null) => {
    setBusy(true);
    try { const ok = await change(endpoint.id, nextVolume, muted); if (!ok) setVolume(endpoint.volume ?? 0); }
    finally { setBusy(false); }
  };
  return <section className="audio-control"><div className="section-title"><h2>{endpoint.direction === 'input' ? 'Microfone' : 'Saída de áudio'}</h2><span className="muted">Windows</span></div><p className="field-help">{endpoint.name}</p>
    {endpoint.volume !== null && <form onSubmit={e => { e.preventDefault(); void apply(volume, null); }}><label className="field-label" htmlFor={volumeId}>{endpoint.direction === 'input' ? 'Nível do microfone' : 'Volume'}<span>{volume}%</span></label><div className="volume-row"><input id={volumeId} type="range" min="0" max="100" value={volume} disabled={busy} onChange={e => setVolume(+e.target.value)}/><button className="button secondary small" disabled={busy || volume === endpoint.volume}>Aplicar</button></div></form>}
    {endpoint.muted !== null && <label className="toggle-row"><span>{endpoint.direction === 'input' ? 'Microfone no mudo' : 'Saída no mudo'}</span><input type="checkbox" checked={endpoint.muted} disabled={busy} onChange={e => void apply(null, e.target.checked)}/></label>}
    {endpoint.volume === null && endpoint.muted === null && <p className="field-help">Este endpoint não disponibilizou controles de volume.</p>}
  </section>;
}

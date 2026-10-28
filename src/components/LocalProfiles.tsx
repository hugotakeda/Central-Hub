import { useState } from 'react';
import type { DeviceSettingsSnapshot, SettingChange } from '../domain/types';
import { localProfiles, saveProfile, deleteProfile, profileChanges } from '../domain/localData';
import { useGearStore } from '../store/useGearStore';
export function LocalProfiles({ model, snapshot, busy, apply }: { model: string; snapshot: DeviceSettingsSnapshot; busy: boolean; apply: (changes: SettingChange[]) => Promise<boolean> }) {
  const [profiles, setProfiles] = useState(() => localProfiles(model)), [name, setName] = useState('');
  const notify = useGearStore(s => s.notify);
  return <section className="surface"><div className="setting-heading"><div><h2>Perfis locais</h2><p className="field-help">Salvos neste computador. Aplique para enviar os ajustes ao dispositivo.</p></div><span className="tag">{profiles.length} / 20</span></div>
    <form className="profile-create" onSubmit={e => { e.preventDefault(); try { saveProfile(model, name, snapshot); setProfiles(localProfiles(model)); setName(''); notify('Perfil salvo com os valores lidos do dispositivo.'); } catch (error) { notify(String(error), true); } }}><input aria-label="Nome do perfil" placeholder="Nome do perfil" maxLength={48} value={name} disabled={busy} onChange={e => setName(e.target.value)} required/><button className="button" disabled={busy || !name.trim() || profiles.length >= 20}>Salvar configuração atual</button></form>
    {!profiles.length && <div className="empty-state"><p>Nenhum perfil salvo.</p><p>Configure o dispositivo e salve a leitura atual acima.</p></div>}
    <div className="profile-list">{profiles.map(p => <div className="profile-row" key={p.id}><div><strong>{p.name}</strong><p className="field-help">{p.settings.kind === 'mouse' ? `${p.settings.dpi} DPI · ${p.settings.polling_hz ?? '—'} Hz` : `Efeito ${p.settings.effect} · brilho ${p.settings.brightness ?? 'misto'} · velocidade ${p.settings.speed ?? 'mista'}`}</p></div><button className="button" disabled={busy} onClick={() => { try { void apply(profileChanges(p, snapshot.settings)); } catch (error) { notify(String(error), true); } }}>Aplicar</button><button className="text-button" disabled={busy} onClick={() => { try { deleteProfile(model, p.id); setProfiles(localProfiles(model)); } catch (error) { notify(String(error), true); } }}>Excluir</button></div>)}</div>
    <p className="field-help">Cada ajuste é confirmado por releitura. Uma falha interrompe a sequência; o estado atual é consultado novamente. Perfis do mouse não alteram o modo nem regravam a memória interna. Níveis mistos do F75 são preservados.</p>
  </section>;
}

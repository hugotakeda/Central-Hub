import { useState } from 'react';
import type { SettingChange, MouseSettings, KeyboardSettings } from '../domain/types';
import { useDeviceSettings } from './useDeviceSettings';
import { Icon } from './Icon';
type Apply = (change: SettingChange) => Promise<void>;
export function MouseControls({ state, busy, apply }: { state: MouseSettings; busy: boolean; apply: Apply }) {
  const [dpi, setDpi] = useState(String(state.dpi)), [polling, setPolling] = useState(state.polling_hz);
  const first = state.dpi_options[0], last = state.dpi_options.at(-1);
  const difference = state.dpi_options[1] - first;
  const step = difference > 0 && state.dpi_options.every((v, i, a) => i === 0 || v - a[i - 1] === difference) ? difference : 'any';
  const validDpi = state.dpi_options.includes(Number(dpi)), software = state.mode === 2;
  return <>
    {!software && <div className="surface control-mode"><h2>Controle por software</h2><p className="field-help">{state.mode === 1 ? 'O mouse está usando a memória interna. Ative o controle por software para ajustar o estado ativo.' : 'Não foi possível ler o modo de configuração. Atualize para tentar novamente.'}</p><button className="button" disabled={busy || state.mode === null} onClick={() => void apply({ kind: 'mouse_mode', mode: 2 })}>Ativar controle por software</button></div>}
    <form className="surface setting-panel" onSubmit={e => { e.preventDefault(); if (validDpi) void apply({ kind: 'mouse_dpi', dpi: Number(dpi) }); }}>
      <div className="setting-heading"><h2><Icon name="speed" size={18}/>Sensibilidade</h2><strong>{state.dpi.toLocaleString('pt-BR')} <small>DPI</small></strong></div>
      <p className="field-help">Valor atual lido do sensor. Ajuste o rascunho e aplique para confirmar no dispositivo.</p>
      <div className="dpi-editor"><label htmlFor="mouse-dpi">DPI</label><input id="mouse-dpi" type="number" min={first} max={last} step={step} value={dpi} onChange={e => setDpi(e.target.value)} disabled={busy || !software} required/><input aria-label="Ajustar sensibilidade" type="range" min="0" max={state.dpi_options.length - 1} value={Math.max(0, state.dpi_options.indexOf(Number(dpi)))} onChange={e => setDpi(String(state.dpi_options[Number(e.target.value)]))} disabled={busy || !software}/><button className="button" disabled={busy || !software || !validDpi || Number(dpi) === state.dpi}>Aplicar</button></div>
      <p className="field-help">{first.toLocaleString('pt-BR')}–{last?.toLocaleString('pt-BR')} DPI{step !== 'any' ? ` · passos de ${step}` : ''}</p>
    </form>
    {state.polling_hz !== null && state.polling_options.length > 0 && <form className="surface setting-panel" onSubmit={e => { e.preventDefault(); if (polling !== null) void apply({ kind: 'mouse_polling', polling_hz: polling }); }}>
      <div className="setting-heading"><h2 id="polling-label"><Icon name="overview" size={18}/>Taxa de atualização</h2><strong>{state.polling_hz.toLocaleString('pt-BR')} <small>Hz</small></strong></div>
      <p className="field-help">Opções anunciadas pelo mouse. Frequências maiores aumentam o consumo.</p>
      <div id="mouse-polling" className="rate-options" role="group" aria-labelledby="polling-label">{[...state.polling_options].sort((a,b) => a-b).map(hz => <button type="button" key={hz} className={polling === hz ? 'selected' : ''} aria-pressed={polling === hz} disabled={busy || !software} onClick={() => setPolling(hz)}><i style={{height: `${5 + hz / Math.max(...state.polling_options) * 13}px`}}/><span>{hz} Hz</span></button>)}</div>
      <div className="setting-footer"><span className="muted">Alteração explícita, confirmada por releitura.</span><button className="button" disabled={busy || !software || polling === state.polling_hz}>Aplicar</button></div>
    </form>}
    {state.battery_percent !== null && <p className="field-help">Bateria · {state.battery_percent}%</p>}
    <p className="field-help">DPI e polling alteram o estado ativo. Outro software de periféricos pode substituí-los. Perfis onboard não são regravados.</p>
    {software && <details className="surface"><summary>Modo de configuração</summary><p className="field-help">O controle por software está ativo. Voltar à memória interna reativa os ajustes já salvos no mouse.</p><button className="button" disabled={busy} onClick={() => void apply({ kind: 'mouse_mode', mode: 1 })}>Usar memória interna</button></details>}
  </>;
}
export function KeyboardControls({ state, busy, apply }: { state: KeyboardSettings; busy: boolean; apply: Apply }) {
  const [effect, setEffect] = useState(state.effect), [brightness, setBrightness] = useState(state.brightness === null ? '' : String(state.brightness)), [speed, setSpeed] = useState(state.speed === null ? '' : String(state.speed));
  return <><section className="surface setting-panel"><div className="setting-heading"><h2><Icon name="keyboard" size={18}/>Iluminação</h2><strong>{state.effect === 0 ? 'Desligada' : `Efeito ${state.effect}`}</strong></div><p className="field-help">Configuração lida do F75 por USB. Os números correspondem aos efeitos internos do firmware.</p>
    <form className="hardware-setting" onSubmit={e => { e.preventDefault(); void apply({ kind: 'keyboard_effect', effect }); }}><label htmlFor="keyboard-effect">Efeito</label><div className="setting-row"><select id="keyboard-effect" value={effect} disabled={busy} onChange={e => setEffect(Number(e.target.value))}>{!state.effect_options.includes(state.effect) && <option value={state.effect} disabled>Personalizado atual</option>}{state.effect_options.map(value => <option key={value} value={value}>{value === 0 ? 'Desligada' : `Efeito ${value}`}</option>)}</select><button className="button" disabled={busy || effect === state.effect || !state.effect_options.includes(effect)}>Aplicar</button></div></form>
    <form className="hardware-setting" onSubmit={e => { e.preventDefault(); if (brightness) void apply({ kind: 'keyboard_brightness', brightness: Number(brightness) }); }}><label htmlFor="keyboard-brightness">Brilho global</label><div className="setting-row"><select id="keyboard-brightness" value={brightness} disabled={busy} onChange={e => setBrightness(e.target.value)}>{state.brightness === null && <option value="" disabled>Níveis diferentes por efeito</option>}{Array.from({ length: 9 }, (_, i) => i + 1).map(value => <option key={value} value={value}>Nível {value}</option>)}</select><button className="button" disabled={busy || !brightness || Number(brightness) === state.brightness}>Aplicar</button></div></form>
    <form className="hardware-setting" onSubmit={e => { e.preventDefault(); if (speed !== '') void apply({ kind: 'keyboard_speed', speed: Number(speed) }); }}><label htmlFor="keyboard-speed">Velocidade global</label><div className="setting-row"><select id="keyboard-speed" value={speed} disabled={busy} onChange={e => setSpeed(e.target.value)}>{state.speed === null && <option value="" disabled>Níveis diferentes por efeito</option>}{[0, 1, 2, 3, 4].map(value => <option key={value} value={value}>Nível {value}</option>)}</select><button className="button" disabled={busy || speed === '' || Number(speed) === state.speed}>Aplicar</button></div></form>
    <p className="field-help">Níveis globais ajustam todos os efeitos internos. Níveis mistos são preservados até você escolher e aplicar um valor.</p></section></>;
}
export function HardwareControls({ deviceId }: { deviceId: string }) {
  const { snapshot, busy, error, reload, apply } = useDeviceSettings(deviceId, true);
  return <section className="hardware-controls" aria-label="Configuração do dispositivo"><div className="section-title"><h2>Configuração</h2><button className="text-button" disabled={busy} onClick={() => void reload()}>Atualizar</button></div>{error && <p className="control-error" role="alert">{error}</p>}{snapshot ? snapshot.settings.kind === 'mouse' ? <MouseControls key={snapshot.revision} state={snapshot.settings} busy={busy} apply={apply}/> : <KeyboardControls key={snapshot.revision} state={snapshot.settings} busy={busy} apply={apply}/> : !error && <p className="field-help" role="status">Consultando o dispositivo…</p>}</section>;
}

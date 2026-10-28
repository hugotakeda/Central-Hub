import { getCurrentWindow } from '@tauri-apps/api/window';
import { desktop } from '../services/bridge';
import { useGearStore } from '../store/useGearStore';

export function WindowChrome() {
  if (!desktop) return null;
  const run = (action: 'minimize' | 'close') => {
    void getCurrentWindow()[action]().catch(error => {
      useGearStore.getState().notify(`Não foi possível controlar a janela: ${String(error)}`, true);
    });
  };
  return <>
    <div className="window-drag-region" data-tauri-drag-region aria-hidden="true"/>
    <div className="window-controls" role="group" aria-label="Controles da janela">
      <button onClick={() => run('minimize')} aria-label="Minimizar" title="Minimizar"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5h10"/></svg></button>
      <button className="window-close" onClick={() => run('close')} aria-label="Fechar Central Hub" title="Fechar (Alt+F4)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m-8 0 8-8"/></svg></button>
    </div>
  </>;
}

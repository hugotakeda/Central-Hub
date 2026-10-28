import { useGearStore, type Page } from '../store/useGearStore';
import { Icon, type IconName } from './Icon';
export function Sidebar() {
  const page = useGearStore(s => s.page), navigate = useGearStore(s => s.navigate);
  const nav = (p: Page, label: string, icon: IconName) => <button className={`nav-item ${page === p || (p === 'home' && page === 'device') ? 'active' : ''}`} onClick={() => navigate(p)} aria-current={page === p ? 'page' : undefined}><Icon name={icon} size={14}/><span>{label}</span></button>;
  return <aside className="sidebar"><div className="brand" aria-label="Central Hub"><img className="brand-mark" src="/brand/central-hub-mark.svg" width="32" height="32" alt=""/><span className="brand-name">central<span>hub</span></span></div><nav aria-label="Navegação principal">
    {nav('home', 'Dispositivos', 'grid')}{nav('test', 'Teste de hardware', 'test')}{nav('hardware', 'Interfaces', 'usb')}
  </nav><div className="sidebar-bottom">{nav('settings', 'Ajustes', 'settings')}<span className="sidebar-version">0.0.2</span></div></aside>;
}

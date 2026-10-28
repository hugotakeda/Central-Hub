export type IconName = 'grid' | 'settings' | 'usb' | 'refresh' | 'close' | 'test' | 'mouse' | 'keyboard' | 'audio' | 'battery' | 'speed' | 'overview' | 'profiles';
const paths: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  settings: <><path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3z"/><circle cx="12" cy="12" r="3"/></>,
  usb: <><path d="M12 21V3m-3 3 3-3 3 3M12 17l-6-5V8m6 6 6-4V7"/><circle cx="6" cy="7" r="1.5"/><path d="M16.5 4h3v3h-3"/></>,
  refresh: <><path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5m-3 9a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  test: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
  mouse: <><rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7M6 10h12"/></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h2M5 13h1m3 0h1m3 0h1m3 0h2M7 16h10"/></>,
  audio: <><path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="12" width="5" height="8" rx="2"/><rect x="17" y="12" width="5" height="8" rx="2"/></>,
  battery: <><rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4M5 10v4m3-4v4m3-4v4"/></>,
  speed: <><path d="M4 18a10 10 0 1 1 16 0M12 14l5-6"/><circle cx="12" cy="14" r="1"/></>,
  overview: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  profiles: <><path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/></>,
};
export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

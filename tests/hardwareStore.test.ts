import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/services/bridge', () => ({ scanHid: vi.fn(), setAudioEndpoint: vi.fn(), readDeviceSettings: vi.fn() }));
import * as bridge from '../src/services/bridge';
import { useGearStore } from '../src/store/useGearStore';
import type { HidScan } from '../src/domain/types';
const empty = (): HidScan => ({ devices: [], audio: [], available: true, error: null });
const endpointScan = (): HidScan => ({ ...empty(), audio: [{ id: 'endpoint', name: 'Cloud Flight', direction: 'output', volume: 30, muted: false }] });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(bridge.scanHid).mockResolvedValue(empty());
  useGearStore.setState({ scan: null, notice: null });
});
it('starts empty and initializes through native discovery', async () => {
  expect(useGearStore.getState().scan).toBeNull();
  await useGearStore.getState().initialize();
  expect(useGearStore.getState()).toMatchObject({ ready: true, scan: empty() });
  expect(bridge.scanHid).toHaveBeenCalled();
});
it('clears stale data when discovery fails', async () => {
  useGearStore.setState({ scan: endpointScan() });
  vi.mocked(bridge.scanHid).mockRejectedValueOnce(new Error('USB access denied'));
  await useGearStore.getState().scanHid();
  expect(useGearStore.getState()).toMatchObject({ scanning: false, scan: { available: false, devices: [], audio: [], error: 'Error: USB access denied' } });
});
it('cannot write to endpoints that were not discovered', async () => {
  expect(await useGearStore.getState().changeAudio('unknown', 50, null)).toBe(false);
  expect(bridge.setAudioEndpoint).not.toHaveBeenCalled();
});
it('keeps the last observed volume when the write fails', async () => {
  useGearStore.setState({ scan: endpointScan() });
  vi.mocked(bridge.setAudioEndpoint).mockRejectedValueOnce(new Error('Endpoint removed'));
  expect(await useGearStore.getState().changeAudio('endpoint', 50, null)).toBe(false);
  expect(useGearStore.getState().scan?.audio[0].volume).toBe(30);
});
it('rejects invalid volume and empty requests before native IPC', async () => {
  useGearStore.setState({ scan: endpointScan() });
  for (const volume of [-1, 101, NaN, 2.5, null]) {
    expect(await useGearStore.getState().changeAudio('endpoint', volume, null)).toBe(false);
  }
  expect(bridge.setAudioEndpoint).not.toHaveBeenCalled();
});
it('coalesces concurrent discovery events and waits for the fresh result', async () => {
  let finish!: (scan: HidScan) => void;
  vi.mocked(bridge.scanHid).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(endpointScan());
  const first = useGearStore.getState().scanHid();
  const second = useGearStore.getState().scanHid();
  const third = useGearStore.getState().scanHid();
  expect(bridge.scanHid).toHaveBeenCalledTimes(1);
  finish(empty());
  await Promise.all([first, second, third]);
  expect(bridge.scanHid).toHaveBeenCalledTimes(2);
  expect(useGearStore.getState()).toMatchObject({ scanning: false, scan: endpointScan() });
});

it('does not try wired settings on a protocol-identified wireless F75', async () => {
  const s:HidScan={...empty(),devices:[{id:'wireless',physical_id:'receiver',vendor_id:0x3554,product_id:0xfa09,product_string:'2.4G Wireless Receiver',manufacturer:'Compx',usage_page:0xff02,usage:2,interface_number:1,bus:'USB',identity:{model:'f75',name:'AULA F75',method:'Compx 2.4 GHz · identificação',model_code:'CD'}}]};
  vi.mocked(bridge.scanHid).mockResolvedValueOnce(s);
  await useGearStore.getState().scanHid();
  expect(bridge.readDeviceSettings).not.toHaveBeenCalled();
  expect(useGearStore.getState().scan).toEqual(s);
});

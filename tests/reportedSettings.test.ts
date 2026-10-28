import {expect,it} from 'vitest';
import {settingsAreReported} from '../src/domain/reportedSettings';
import type {MouseStatus} from '@openmouse/protocol/drivers/mouse-types';
it('never presents the assumed DPI/polling of a write-only driver as a real current reading',()=>{
  const writeOnly={dpi:800,pollingRateHz:1000,ui:{settingsReady:true,valuesVerified:false}} as MouseStatus;
  expect(settingsAreReported(writeOnly)).toBe(false);
  expect(settingsAreReported({...writeOnly,ui:{settingsReady:false}})).toBe(false);
  expect(settingsAreReported({...writeOnly,ui:{settingsReady:false,valuesVerified:true}})).toBe(true);
  expect(settingsAreReported({...writeOnly,ui:{settingsReady:true,valuesVerified:true}})).toBe(true);
  expect(settingsAreReported(null)).toBe(false);
});

import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MouseControls, KeyboardControls } from '../src/components/HardwareControls';
import type { MouseSettings, KeyboardSettings } from '../src/domain/types';
const mouse: MouseSettings = { kind: 'mouse', dpi: 800, dpi_options: [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800], polling_hz: 1000, polling_options: [1000, 500, 250, 125], mode: 2, battery_percent: 38 };
const apply = async () => {};
it('renders the reported current mouse values and advertised options', () => {
  const html = renderToStaticMarkup(<MouseControls state={mouse} busy={false} apply={apply}/>);
  expect(html).toContain('value="800"');
  expect(html).toContain('Bateria · 38%');
  expect(html).toContain('500 Hz');
  expect(html).not.toContain('8000 Hz');
  expect(html).not.toContain('Ativar controle por software');
});
it('does not invent an unknown battery or polling reading', () => {
  const html = renderToStaticMarkup(<MouseControls state={{ ...mouse, battery_percent: null, polling_hz: null, polling_options: [] }} busy={false} apply={apply}/>);
  expect(html).not.toContain('Bateria');
  expect(html).not.toContain('mouse-polling');
});
it('requires an explicit software-mode action for onboard configuration', () => {
  const html = renderToStaticMarkup(<MouseControls state={{ ...mouse, mode: 1 }} busy={false} apply={apply}/>);
  expect(html).toContain('Ativar controle por software');
  expect(html).toContain('disabled=""');
});
it('preserves mixed keyboard levels instead of displaying fabricated defaults', () => {
  const state: KeyboardSettings = { kind: 'keyboard', effect: 11, effect_options: [0, 1, 11, 18], brightness: null, speed: null };
  const html = renderToStaticMarkup(<KeyboardControls state={state} busy={false} apply={apply}/>);
  expect(html).toContain('value="11" selected=""');
  expect(html).toContain('Níveis diferentes por efeito');
  expect(html).toContain('Brilho global');
  expect(html).not.toContain('type="color"');
});

it('labels wireless configuration accurately and allows a reported zero brightness', () => {
  const state:KeyboardSettings={kind:'keyboard',effect:15,effect_options:[0,15],brightness:0,speed:2,transport:'wireless',brightness_min:0};
  const html=renderToStaticMarkup(<KeyboardControls state={state} busy={false} apply={apply}/>);
  expect(html).toContain('2,4 GHz');
  expect(html).toContain('value="0" selected=""');
  expect(html).toContain('Nível 0');
  expect(html).not.toContain('por USB');
});

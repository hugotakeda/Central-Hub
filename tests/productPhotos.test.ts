import { expect, it } from 'vitest';
import { productPhoto } from '../src/domain/productPhotos';
it('uses catalog colors only for recognized model identities', () => {
  expect(productPhoto({ id: 'superlight' })?.src).toContain('magenta');
  expect(productPhoto({ id: 'f75' })?.src).toContain('black');
  expect(productPhoto({ id: 'cloud-flight' })?.src).toContain('cloud-flight');
});
it('does not assign a specific product photo to unidentified interfaces', () => {
  expect(productPhoto({ id: 'interfaces:1133:50503:USB Receiver' })).toBeNull();
  expect(productPhoto({ id: 'unidentified' })).toBeNull();
});

it('does not assign an original G Pro keyboard picture to its wireless X variants', () => {
  expect(productPhoto({id:'g-pro-tkl'})?.src).toContain('logitech-g-pro-tkl');
  expect(productPhoto({id:'g-pro-x-tkl'})).toBeNull();
});

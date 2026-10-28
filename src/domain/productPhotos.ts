import type { DeviceVisual } from './types';
const photos = {
  superlight: { src: '/products/superlight-magenta.png', alt: 'Logitech G Pro X Superlight original, magenta' },
  f75: { src: '/products/aula-f75-black.webp', alt: 'Aula F75 preto, foto de catálogo' },
  'cloud-flight': { src: '/products/cloud-flight.webp', alt: 'HyperX Cloud Flight preto e vermelho' },
  'g-pro-tkl': { src: '/products/logitech-g-pro-tkl.png', alt: 'Logitech G Pro TKL com fio, foto de catálogo; layout e switches podem variar' },
} as const;
export function productPhoto(device: Pick<DeviceVisual, 'id'>) {
  return Object.hasOwn(photos, device.id) ? photos[device.id as keyof typeof photos] : null;
}

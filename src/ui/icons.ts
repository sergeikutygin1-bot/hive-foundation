/** 24×24 stroke icons as inline SVG markup: no image files. */
const ICONS = {
  coin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/>',
  honey: '<path d="M8 4h8M9 4v2.5C6.5 7.5 5 9.5 5 12.5V17a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4.5c0-3-1.5-5-4-6V4"/><path d="M5.5 12.5h13"/>',
  cart: '<path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20 8H6.3"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  basket: '<path d="M4 10h16l-1.6 8.4a2 2 0 0 1-2 1.6H7.6a2 2 0 0 1-2-1.6z"/><path d="M8 10l3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  hive: '<path d="M5 9h14v10H5zM4 9l1-3h14l1 3M5 13h14M10 19v-2.5h4V19"/>',
  flower: '<circle cx="12" cy="8" r="2"/><circle cx="12" cy="4.5" r="1.8"/><circle cx="15.3" cy="8" r="1.8"/><circle cx="8.7" cy="8" r="1.8"/><circle cx="12" cy="11.5" r="1.8"/><path d="M12 13.3V21M12 17.5c-1.8 0-3.2-1-3.7-2.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M6 12h12M12 6v12"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  svg.innerHTML = ICONS[name];
  return svg;
}

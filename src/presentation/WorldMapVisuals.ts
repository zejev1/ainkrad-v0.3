import type { WorldPlaceKind } from '../world/types';

/** Original Ainkrad vector drawings. No Alicization Town images or source are included. */
export function placeDrawing(kind: WorldPlaceKind): string {
  let body: string;
  switch(kind) {
    case 'home':
      body='<rect x="1" y="1" width="58" height="48" rx="2" fill="#dbcaac" stroke="#594b3e"/><path d="M1 5H59V43H1Z" fill="#9d5641"/><path d="M1 24H59M7 5V43M16 5V43M25 5V43M34 5V43M43 5V43M52 5V43" stroke="#c9805d" stroke-width="1.5"/><path d="M1 24H59" stroke="#6b352c" stroke-width="3"/><path d="M43 8H50V18H43Z" fill="#63594a"/><path d="M27 44H34V49H27Z" fill="#5f4735"/>';
      break;
    case 'construction_site':
      body='<path d="M3 47H57" stroke="#7c674a" stroke-width="4"/><path d="M8 45V10M52 45V10M8 14H52M15 14V45M45 14V45M15 27H45" fill="none" stroke="#8b633d" stroke-width="3"/><path d="M5 10L30 2L55 10" fill="none" stroke="#6f5438" stroke-width="3"/><path d="M18 45V32H34V45" fill="#b89d70" stroke="#6b5940"/><path d="M39 33L50 45M50 33L39 45" stroke="#b6a272" stroke-width="2"/>';
      break;
    case 'workshop':
      body='<rect x="2" y="3" width="54" height="40" fill="#b6a383" stroke="#574f43"/><path d="M2 6H56V33H2Z" fill="#635f58"/><path d="M3 19H56M15 6V33M30 6V33M45 6V33" stroke="#858077" stroke-width="2"/><rect x="40" y="2" width="10" height="15" fill="#4b4440"/><path d="M6 45H54" stroke="#705f41" stroke-width="5"/>';
      break;
    case 'library':
      body='<rect x="2" y="1" width="56" height="43" fill="#c9c6b6" stroke="#566065"/><path d="M2 2H58V32H2Z" fill="#526b77"/><path d="M2 17H58M13 2V32M25 2V32M37 2V32M49 2V32" stroke="#7d9496"/><path d="M17 43V35H43V43M14 47H46" fill="none" stroke="#e4d6ad" stroke-width="3"/><rect x="26" y="34" width="8" height="10" fill="#43433e"/>';
      break;
    case 'resource_field':
      body='<path d="M2 3H58V47H2Z" fill="#8b794a" stroke="#74603b"/><path d="M6 4L14 45M16 4L24 45M26 4L34 45M36 4L44 45M46 4L54 45" stroke="#c5b469" stroke-width="4"/>';
      break;
    case 'forest':
    case 'quiet_space':
      body='<path d="M14 35V49M43 31V45" stroke="#71583b" stroke-width="4"/><path d="M14 1L1 35H27ZM43 0L28 32H58Z" fill="#315b48" stroke="#244737"/><path d="M14 9V30M43 8V28" stroke="#4e7657" stroke-width="2"/>';
      break;
    case 'cemetery':
      body='<path d="M1 1H59V49H1Z" fill="#7e8b72"/><path d="M10 9H24V24H10ZM36 9H50V24H36ZM10 31H24V45H10ZM36 31H50V45H36Z" fill="#bdc0ae" stroke="#747e73"/><path d="M30 1V49" stroke="#b2a78a" stroke-width="4"/>';
      break;
    case 'mountains':
      body='<path d="M1 46L24 4L40 32L48 17L59 46Z" fill="#7f8277" stroke="#565e58"/><path d="M24 4L31 19L22 16L17 19Z" fill="#dfdfc9"/><path d="M24 4L40 46" stroke="#a3a596"/>';
      break;
    case 'ruins':
      body='<path d="M4 43V12H23V20H13V43ZM36 43V4H55V43H46V14H42V43Z" fill="#939384" stroke="#5e6b60"/><path d="M17 35H30V46H17ZM23 25H32V31H23Z" fill="#a5a394"/><path d="M2 48H58" stroke="#697d55" stroke-width="4"/>';
      break;
    case 'lake':
    case 'ocean':
      body='<path d="M1 2H59V48H1Z" fill="#467a8e"/><path d="M5 12Q13 6 21 12T37 12T55 12M5 26Q13 20 21 26T37 26T55 26M5 40Q13 34 21 40T37 40T55 40" fill="none" stroke="#a1c6c2" stroke-width="2"/>';
      break;
    case 'river':
      body='<path d="M1 1H59V49H1Z" fill="#719269"/><path d="M14 -2C-2 20 65 28 37 54" fill="none" stroke="#c3b688" stroke-width="15"/><path d="M14 -2C-2 20 65 28 37 54" fill="none" stroke="#538797" stroke-width="11"/>';
      break;
    case 'village':
    case 'city':
      body='<path d="M28 0V50M0 27H60" stroke="#cab68d" stroke-width="6"/><path d="M2 3H20V20H2ZM36 3H55V20H36ZM2 33H20V48H2ZM36 33H55V48H36Z" fill="#bdaa86" stroke="#584e40"/><path d="M2 10H20M36 10H55M2 40H20M36 40H55" stroke="#925b43" stroke-width="10"/>';
      break;
    case 'swamp':
      body='<path d="M1 2H59V48H1Z" fill="#748966"/><path d="M2 15Q17 4 30 19T58 15M2 38Q17 27 30 42T58 38" fill="none" stroke="#506f70" stroke-width="8"/><path d="M14 30V15M10 18L14 23L18 17M44 49V30M40 34L44 39L48 33" stroke="#a5aa71" stroke-width="2" fill="none"/>';
      break;
    case 'shore':
      body='<path d="M1 1H59V49H1Z" fill="#4e8a9b"/><path d="M0 0H24L19 13L31 26L25 41L30 50H0Z" fill="#bfb788"/><path d="M36 9H52M41 25H57M34 39H50" stroke="#a1c6c2" stroke-width="2"/>';
      break;
    case 'commons':
      body='<path d="M2 2H58V48H2Z" fill="#aaa184" stroke="#7f7963"/><path d="M2 13H58M2 25H58M2 37H58M15 2V48M30 2V48M45 2V48" stroke="#beb59a"/><circle cx="30" cy="25" r="9" fill="#737d76" stroke="#d6c9a6" stroke-width="3"/><circle cx="30" cy="25" r="5" fill="#568597"/>';
      break;
    default:
      body='<path d="M2 38L18 13L28 28L41 6L58 38Z" fill="#618761"/><path d="M4 44H56" stroke="#9ca777" stroke-width="3"/>';
  }
  return `<svg class="place-art" viewBox="0 0 60 50" aria-hidden="true" focusable="false">${body}</svg>`;
}

export type MapDetail = 'region' | 'town' | 'street';
export function mapDetail(pixelsPerUnit:number): MapDetail {
  return pixelsPerUnit<3?'region':pixelsPerUnit<120?'town':'street';
}

/** Pixel distances are derived from the same 100m/world-unit convention as navigation. */
export function mapScaleBar(pixelsPerUnit:number): {metres:number;pixels:number;label:string} {
  const availableMetres=90*100/pixelsPerUnit;
  const magnitude=10**Math.floor(Math.log10(availableMetres));
  const metres=[5,2,1].map(n=>n*magnitude).find(n=>n<=availableMetres)??magnitude;
  return {metres,pixels:metres*pixelsPerUnit/100,
    label:metres>=1000?`${Number((metres/1000).toPrecision(3))} км`:`${Number(metres.toPrecision(3))} м`};
}

export function mapEntityDepth(percentY:number,pixelHeight:number,viewportHeight:number): number {
  return 10+Math.max(0,Math.min(1800,Math.round(percentY/100*viewportHeight+pixelHeight/2)));
}

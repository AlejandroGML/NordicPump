import { type Country } from '@core/services/country-state.service';

/** Flag rectangle definitions in viewBox coordinates (24×16). */
interface FlagDef {
  rects: string[];
}

const FLAGS: Record<Country, FlagDef> = {
  SE: { rects: [
    '<rect width="24" height="16" fill="#006AA7"/>',
    '<rect x="7" width="4" height="16" fill="#FECC00"/>',
    '<rect y="6" width="24" height="4" fill="#FECC00"/>',
  ] },
  DK: { rects: [
    '<rect width="24" height="16" fill="#C8102E"/>',
    '<rect x="8" width="4" height="16" fill="#FFFFFF"/>',
    '<rect y="6" width="24" height="4" fill="#FFFFFF"/>',
  ] },
  FI: { rects: [
    '<rect width="24" height="16" fill="#FFFFFF"/>',
    '<rect x="7" width="4" height="16" fill="#003580"/>',
    '<rect y="6" width="24" height="4" fill="#003580"/>',
  ] },
  NO: { rects: [
    '<rect width="24" height="16" fill="#BA0C2F"/>',
    '<rect x="7" width="4" height="16" fill="#FFFFFF"/>',
    '<rect y="6" width="24" height="4" fill="#FFFFFF"/>',
    '<rect x="9" width="2" height="16" fill="#00205B"/>',
    '<rect y="7" width="24" height="2" fill="#00205B"/>',
  ] },
  IS: { rects: [
    '<rect width="24" height="16" fill="#003897"/>',
    '<rect x="7" width="4" height="16" fill="#FFFFFF"/>',
    '<rect y="6" width="24" height="4" fill="#FFFFFF"/>',
    '<rect x="9" width="2" height="16" fill="#D72828"/>',
    '<rect y="7" width="24" height="2" fill="#D72828"/>',
  ] },
};

/**
 * Generate an inline SVG flag for a Nordic country at the requested size.
 *
 * The viewBox is fixed at 24×16; the SVG scales to *width*×*height*.
 * Single source of truth — used by both country-selector and header.
 */
export function flagSvg(country: Country, width = 24, height = 16, style = ''): string {
  const def = FLAGS[country];
  const styleAttr = style ? ` style="${style}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" width="${width}" height="${height}" role="img" aria-label="${country} flag"${styleAttr}>${def.rects.join('')}</svg>`;
}

import { Dwg_Color } from '../types/index.js';
/**
 * Decodes a libredwg CMC {@link Dwg_Color} into the numeric form expected by
 * MTEXT `backgroundFillColor`: an ACI index `1..255`, or a 24-bit RGB.
 *
 * Returns `undefined` for ByLayer / ByBlock / None (and similar placeholders
 * AutoCAD stores when `bg_fill_flag` is 2 or 3 — canvas / window background).
 * Those must not be passed through as `color.rgb` (`0xC0000000` etc.), whose
 * low 24 bits are zero and render as pure black.
 */
export declare function dwgColorToBackgroundFillColor(color: Dwg_Color | undefined | null): number | undefined;
//# sourceMappingURL=dwgColorToBackgroundFillColor.d.ts.map
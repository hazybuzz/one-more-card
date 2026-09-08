export const GAME_FONT_NAME = 'Noto Serif SC';
export const DISPLAY_FONT_NAME = 'Almendra SC';

// Almendra SC supplies Latin glyphs while Noto Serif SC naturally handles CJK fallback.
// Keeping both in one stack also styles mixed-language labels without locale-specific branches.
export const GAME_FONT_FAMILY = `"${DISPLAY_FONT_NAME}", "${GAME_FONT_NAME}", "PingFang SC", "Microsoft YaHei", serif`;

export const DISPLAY_FONT_FAMILY = `"${DISPLAY_FONT_NAME}", "${GAME_FONT_NAME}", Georgia, serif`;

export const CARD_FONT_FAMILY = DISPLAY_FONT_FAMILY;

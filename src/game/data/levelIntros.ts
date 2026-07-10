export function introIdForLevel(levelId: string): string {
  if (levelId === 'chapter1_2') {
    return 'chapter1_2_opening';
  }

  if (levelId === 'chapter1_3') {
    return 'chapter1_3_opening';
  }

  if (levelId === 'chapter1_4') {
    return 'chapter1_4_opening';
  }

  return 'chapter1_opening';
}

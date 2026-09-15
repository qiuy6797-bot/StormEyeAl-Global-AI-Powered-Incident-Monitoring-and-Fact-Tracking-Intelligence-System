export function needsChineseTranslation(value: string): boolean {
  const words = value.match(/[A-Za-z]{2,}/g) ?? [];
  const han = value.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return words.length >= 2 && words.join("").length > han * 3;
}

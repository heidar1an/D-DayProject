export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export function difficultyFromPercent(percent) {
  return percent > 70 ? 'easy' : percent >= 50 ? 'medium' : percent >= 40 ? 'hard' : 'very_hard';
}

export function examDateLabel(question) {
  const month = JALALI_MONTHS[Number(question?.examMonth) - 1] ?? '—';
  return `${month} ${question?.year ?? '—'}`;
}

export const questionKindLabel = (question) => question?.source === 'tapesh' ? 'تألیفی' : 'کشوری';

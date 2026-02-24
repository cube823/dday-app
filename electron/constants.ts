// ─── Game Mechanic Constants ─────────────────────────────────────────────────

export const DIFFICULTY_XP: Record<string, number> = {
  easy: 50,
  normal: 100,
  hard: 200,
  epic: 500,
};

export const TOLERANCE_STATES = [
  { max: 20, name: '각성 상태', willpower: 3, focus: 3, xpMultiplier: 1.0 },
  { max: 40, name: '맑은 정신', willpower: 2, focus: 2, xpMultiplier: 1.0 },
  { max: 60, name: '보통', willpower: 0, focus: 0, xpMultiplier: 1.0 },
  { max: 80, name: '흐릿한 정신', willpower: -1, focus: -1, xpMultiplier: 1.0 },
  { max: 100, name: '도파민 과부하', willpower: -2, focus: -2, xpMultiplier: 0.8 },
];

export const QUEST_TOLERANCE_REDUCTION: Record<string, number> = {
  easy: -2, normal: -3, hard: -4, epic: -5,
};

export function getToleranceState(tolerance: number) {
  const clamped = Math.max(0, Math.min(100, tolerance));
  return TOLERANCE_STATES.find(s => clamped <= s.max) || TOLERANCE_STATES[TOLERANCE_STATES.length - 1];
}

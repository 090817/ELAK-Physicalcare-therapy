import { trainings } from './trainings'

const TIERS = [
  { level: 'bronze', label: 'Bronze', stage: 'Bronze', tone: 'bronze', wash: 'from-[#f8e6d2] via-[#fff8ee] to-[#f3efe7]' },
  { level: 'silver', label: 'Silver', stage: 'Silver', tone: 'silver', wash: 'from-[#f4f4f6] via-[#fbfbfd] to-[#e7f4ef]' },
  { level: 'gold', label: 'Gold', stage: 'Gold', tone: 'gold', wash: 'from-[#fff3c4] via-[#fff9e8] to-[#ffe7c8]' },
]

const DAY_TIERS = [
  { level: 'bronze', threshold: 1 },
  { level: 'silver', threshold: 5 },
  { level: 'gold', threshold: 20 },
]

function tierMeta(level) {
  return TIERS.find((item) => item.level === level)
}

function tierAward({ group, emoji, level, threshold, unit, stat, trainingId, title, description, blessing }) {
  const meta = tierMeta(level)
  return {
    id: trainingId ? `${trainingId}-${level}` : `${group}-${level}`,
    group,
    kind: 'award',
    level,
    trainingId: trainingId ?? null,
    stat,
    threshold,
    unit,
    emoji,
    tone: meta.tone,
    stage: meta.stage,
    title,
    description,
    blessing,
    wash: meta.wash,
  }
}

export const awardTabs = [
  { id: 'training', label: 'Training' },
  { id: 'days', label: 'Check-ins' },
  { id: 'streak', label: 'Streak' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'calories', label: 'Energy' },
  { id: 'time', label: 'Time' },
  { id: 'scene', label: 'Life' },
]

export const awards = [
  ...DAY_TIERS.map((tier) =>
    tierAward({
      group: 'days',
      emoji: '📅',
      level: tier.level,
      threshold: tier.threshold,
      unit: 'days',
      stat: 'days',
      title: `Practice days · ${tierMeta(tier.level).label}`,
      description: 'Each day you finish ankle rehab is kept. This streak of days will be remembered.',
      blessing: 'Days you showed up still count, even if a few are missed.',
    }),
  ),
  ...DAY_TIERS.map((tier) =>
    tierAward({
      group: 'streak',
      emoji: '🔥',
      level: tier.level,
      threshold: tier.threshold,
      unit: 'days',
      stat: 'streak',
      title: `Days in a row · ${tierMeta(tier.level).label}`,
      description: 'Days in a row form a streak. Missed days do not take back badges you already lit.',
      blessing: 'This streak stays. A gap in the middle will not erase it.',
    }),
  ),
  ...trainings.flatMap((training) =>
    DAY_TIERS.map((tier) =>
      tierAward({
        group: 'training',
        emoji: training.emoji,
        level: tier.level,
        threshold: tier.threshold,
        unit: 'days',
        stat: 'training',
        trainingId: training.id,
        title: `${training.name} · ${tierMeta(tier.level).label}`,
        description: `Finish ${training.name} on different days and the movement will feel more familiar.`,
        blessing: `${training.name} is saved. Next time, the body will still know it.`,
      }),
    ),
  ),
  ...[
    { level: 'bronze', threshold: 10 },
    { level: 'silver', threshold: 25 },
    { level: 'gold', threshold: 50 },
  ].map((tier) =>
    tierAward({
      group: 'sessions',
      emoji: '🏋️',
      level: tier.level,
      threshold: tier.threshold,
      unit: 'sessions',
      stat: 'sessions',
      title: `Sessions · ${tierMeta(tier.level).label}`,
      description: 'Each finished training counts as one session. You can do more than one in a day.',
      blessing: 'These sessions stay. You do not have to count them again.',
    }),
  ),
  ...[
    { level: 'bronze', threshold: 100 },
    { level: 'silver', threshold: 500 },
    { level: 'gold', threshold: 1500 },
  ].map((tier) =>
    tierAward({
      group: 'calories',
      emoji: '⚡',
      level: tier.level,
      threshold: tier.threshold,
      unit: 'kcal',
      stat: 'kcal',
      title: `Energy used · ${tierMeta(tier.level).label}`,
      description: 'Each training has its own energy use. Finished work adds those kcal.',
      blessing: 'This energy use is saved. It can grow slowly.',
    }),
  ),
]

export function awardCurrent(award, stats) {
  if (award.stat === 'training') return stats.byTraining[award.trainingId] ?? 0
  return stats[award.stat] ?? 0
}

export function evaluateAwards(stats) {
  return awards.map((award) => {
    const current = awardCurrent(award, stats)
    return { ...award, current, unlocked: current >= award.threshold }
  })
}

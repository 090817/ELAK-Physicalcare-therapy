export const timeMilestones = [
  {
    id: 'rest',
    kind: 'time',
    threshold: 10 * 60,
    mark: '10 min',
    stage: 'Today’s share',
    title: 'Shoulders down',
    description: 'Finish today’s ten minutes and the shoulders start to drop.',
    teaser: 'Fill today’s ten minutes and the neck will feel lighter.',
    blessing: 'Ten minutes is enough for the body to remember one rest.',
    icon: 'rest',
    wash: 'from-[#fff1df] via-[#fff8ee] to-[#e7f6ea]',
  },
  {
    id: 'breath',
    kind: 'time',
    threshold: 30 * 60,
    mark: '30 min',
    stage: 'Half hour',
    title: 'Slower breath',
    description: 'Scattered minutes add up to half an hour, and the breath is less rushed.',
    teaser: 'A little more time, and the breath will slow down.',
    blessing: 'Half an hour of ease lets the breath find its own pace.',
    icon: 'breath',
    wash: 'from-[#e7f4f1] via-[#f4fbf6] to-[#ffe8d2]',
  },
  {
    id: 'hour',
    kind: 'time',
    threshold: 60 * 60,
    mark: '1 hour',
    stage: 'One hour',
    title: 'Body remembers',
    description: 'After an hour, the body starts to find ease on its own.',
    teaser: 'These minutes will stay with the body.',
    blessing: 'The body remembers that rest can come slowly.',
    icon: 'clock',
    wash: 'from-[#ffe7c8] via-[#fff6ea] to-[#e5f6ec]',
  },
  {
    id: 'afternoon',
    kind: 'time',
    threshold: 3 * 60 * 60,
    mark: '3 hours',
    stage: 'Three hours',
    title: 'Easy afternoon',
    description: 'Ten minutes a day add up to an easy afternoon.',
    teaser: 'You do not have to finish it all at once. Time will grow.',
    blessing: 'An easy afternoon is saved a little each day.',
    icon: 'sun',
    wash: 'from-[#fff3df] via-[#f7fbf4] to-[#ffe1c2]',
  },
]

export function getNextTimeMilestone(seconds) {
  return timeMilestones.find((item) => seconds < item.threshold) ?? null
}

export function getUnlockedTimeMilestones(previousSeconds, nextSeconds) {
  return timeMilestones.filter((item) => previousSeconds < item.threshold && nextSeconds >= item.threshold)
}

export const trainings = [
  { id: 'anklePumps', name: 'Ankle pumps', emoji: '👣', kcal: 3 },
  { id: 'toeRaises', name: 'Toe raises', emoji: '🦶', kcal: 4 },
  { id: 'ankleEversion', name: 'Ankle eversion', emoji: '↔️', kcal: 3 },
  { id: 'ankleInversion', name: 'Ankle inversion', emoji: '↕️', kcal: 3 },
  { id: 'heelRaises', name: 'Heel raises', emoji: '🦵', kcal: 5 },
  { id: 'heelsDownSquat', name: 'Heels-down squat', emoji: '🧎', kcal: 6 },
  { id: 'singleLegBalance', name: 'Single-leg balance', emoji: '🦩', kcal: 4 },
  { id: 'ankleAlphabet', name: 'Ankle alphabet', emoji: '🔤', kcal: 3 },
]

const byId = new Map(trainings.map((item) => [item.id, item]))

export function trainingById(id) {
  return byId.get(id) ?? null
}

export function mergeTrainings(current, trainingId) {
  const list = Array.isArray(current) ? current.filter((id) => byId.has(id)) : []
  if (trainingId && byId.has(trainingId) && !list.includes(trainingId)) list.push(trainingId)
  return list
}

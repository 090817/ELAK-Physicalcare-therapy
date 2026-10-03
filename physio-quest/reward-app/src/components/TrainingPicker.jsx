import { trainings } from '../data/trainings'

export default function TrainingPicker({ selectedId, onSelect, label = 'Training' }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={label}>
      {trainings.map((item) => {
        const selected = item.id === selectedId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(item.id)}
            className={`shrink-0 cursor-pointer rounded-full px-3 py-2 text-sm font-semibold ${
              selected ? 'bg-[#1c7a4d] text-white' : 'bg-white/80 text-ink'
            }`}
          >
            <span className="mr-1" aria-hidden="true">
              {item.emoji}
            </span>
            {item.name}
          </button>
        )
      })}
    </div>
  )
}

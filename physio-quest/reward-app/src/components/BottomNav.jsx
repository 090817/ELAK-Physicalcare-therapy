const ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'achievements', label: 'Rewards' },
]

export default function BottomNav({ page, onChange, active }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4" aria-label="Pages">
      <div className="mx-auto grid max-w-xl grid-cols-3 rounded-full border border-white/80 bg-white/90 p-1 shadow-[0_12px_30px_rgba(90,110,90,0.12)] backdrop-blur-md">
        {ITEMS.map((item) => {
          const current = page === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={current ? 'page' : undefined}
              className={`relative h-11 cursor-pointer rounded-full text-sm font-semibold ${current ? 'bg-[#e7f7ee] text-leaf' : 'text-mist'}`}
            >
              {item.label}
              {item.id === 'today' && active ? (
                <span className="absolute top-2 right-[30%] h-1.5 w-1.5 rounded-full bg-[#f0b56a]" />
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

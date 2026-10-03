import { useEffect, useRef, useState } from 'react'
import { episodeSlots } from '../data/episodes'

export default function EpisodePage({ unlocked = 0, autoplay = false }) {
  const slots = episodeSlots()
  const firstOpen = slots.find((item) => item.id <= unlocked && item.src) || null
  const [current, setCurrent] = useState(firstOpen)
  const [missing, setMissing] = useState(false)
  const player = useRef(null)

  useEffect(() => {
    if (!autoplay || !current?.src || !player.current) return
    const video = player.current
    const play = video.play()
    if (play && typeof play.catch === 'function') play.catch(() => {})
  }, [autoplay, current])

  return (
    <div className="mt-2">
      {current && current.id <= unlocked && current.src ? (
        <div className="episode-stage relative mt-3 w-full overflow-hidden rounded-[24px] bg-black shadow-[0_20px_50px_rgba(90,110,90,0.08)]">
          <video
            ref={player}
            className="absolute inset-0 h-full w-full object-contain"
            src={current.src}
            controls
            playsInline
            preload="metadata"
            onError={() => setMissing(true)}
            onLoadedData={() => setMissing(false)}
          >
            Your browser cannot play this episode.
          </video>
        </div>
      ) : (
        <div className="mt-3 grid min-h-40 place-items-center rounded-[24px] border border-dashed border-[#d5dbd6] bg-white/70 px-6 py-10 text-center">
          <p className="text-lg font-semibold text-ink">Episode 1 is locked</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-mist">Finish today&apos;s exercise plan, then this episode will open here.</p>
        </div>
      )}
      {missing ? (
        <p className="mt-2 text-sm text-mist">The episode file is missing. Put episode-01.mp4 in the Rewards episodes folder.</p>
      ) : null}

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {slots.map((item) => {
          const open = item.id <= unlocked
          const selected = current && current.id === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => open && item.src && setCurrent(item)}
              disabled={!open}
              className={`w-40 shrink-0 rounded-[18px] border p-3 text-left ${
                selected
                  ? 'border-[#1c7a4d] bg-[#e7f7ee]'
                  : open
                    ? 'cursor-pointer border-white/80 bg-white/80'
                    : 'cursor-not-allowed border-[#efe8dc] bg-[#f7f5f1] opacity-80'
              }`}
            >
              <p className="text-xs font-semibold tracking-wide text-mist">{open ? 'Unlocked' : `Day ${item.id}`}</p>
              <h2 className="mt-1 text-base font-semibold text-ink">{item.title}</h2>
            </button>
          )
        })}
      </div>
    </div>
  )
}

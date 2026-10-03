import { useMemo, useState } from 'react'
import { AVATAR_STAGES, avatarNextOf, avatarProgress, avatarStageOf } from '../data/avatar'
import {
  CLOTHES,
  GLASSES,
  HATS,
  addMoney,
  afterAdult,
  buyItem,
  itemEarned,
  itemOwned,
  itemReady,
  money,
  outfitOf,
  readShop,
  syncShopEarn,
  wearItem,
} from '../data/outfit'
import KaleDressup from './KaleDressup'

export default function AvatarPage({ growth = 0 }) {
  const [shop, setShop] = useState(() => syncShopEarn(readShop(), growth))
  const [note, setNote] = useState('')
  const [closetOpen, setClosetOpen] = useState(false)

  const now = avatarStageOf(growth)
  const next = avatarNextOf(growth)
  const fill = Math.round(avatarProgress(growth) * 100)
  const grown = now.id === 'adult'
  const extra = afterAdult(growth)
  const outfit = useMemo(() => outfitOf(shop), [shop])

  const wear = (slot, item) => {
    if (!grown) return
    if (!itemReady(shop, item, growth)) return
    setShop(wearItem(shop, slot, item.id))
    setNote('')
  }

  const buy = (item) => {
    if (!grown) return
    const result = buyItem(shop, item.id)
    setShop(result.shop)
    if (result.error === 'money') setNote('Not enough money. Pay $5 to add cash, or finish more exercises.')
    else if (result.error) setNote('')
    else {
      setNote('Bought ' + item.label + '.')
      setShop(wearItem(result.shop, slotOf(item), item.id))
    }
  }

  return (
    <section className="mt-4">
      <div className="rounded-[32px] border border-white/80 bg-white/80 px-6 py-8 text-center shadow-[0_20px_50px_rgba(90,110,90,0.08)]">
        <p className="text-sm tracking-wide text-mist">Kale</p>
        <h2 className="mt-1 text-[1.6rem] font-semibold text-ink">{now.label}</h2>
        {grown ? (
          <KaleDressup src={now.src} alt={'Kale as ' + now.label} outfit={outfit} className="mt-4" />
        ) : (
          <img src={now.src} alt={'Kale as ' + now.label} className="mx-auto mt-5 h-64 w-64 object-contain" />
        )}
        {next.stage ? (
          <p className="mt-5 text-[15px] leading-7 text-[#5e6d66]">
            {growth} growth point{growth === 1 ? '' : 's'}. {next.remain} more to become {next.stage.label.toLowerCase()}.
          </p>
        ) : (
          <p className="mt-5 text-[15px] leading-7 text-[#5e6d66]">
            {growth} growth points. Kale is fully grown.
            {extra ? ' ' + extra + ' extra exercise' + (extra === 1 ? '' : 's') + ' toward closet items.' : ''}
          </p>
        )}
        <div className="mx-auto mt-4 h-3 max-w-md overflow-hidden rounded-full bg-[#efe8dc]">
          <div className="h-full rounded-full bg-[#1f6b45] transition-[width] duration-500" style={{ width: fill + '%' }} />
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          aria-expanded={closetOpen}
          onClick={() => setClosetOpen((open) => !open)}
          className="w-full rounded-full bg-[#24352d] px-5 py-3 text-sm font-semibold text-white"
        >
          {closetOpen ? 'Close closet' : 'Closet'}
        </button>
        {closetOpen ? (
          <div className={`mt-3 rounded-[28px] border border-white/80 bg-white/80 px-5 py-5 shadow-[0_16px_40px_rgba(90,110,90,0.06)] ${grown ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-mist">
                {grown
                  ? 'Finish more exercises to unlock items, or pay to buy them now.'
                  : 'Closet unlocks when Kale reaches adult.'}
              </p>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink">Wallet {money(shop.wallet)}</p>
                <button
                  type="button"
                  disabled={!grown}
                  className="mt-2 rounded-full bg-[#24352d] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed"
                  onClick={() => {
                    setShop(addMoney(shop, 5))
                    setNote('Paid $5. Cash added to the wallet.')
                  }}
                >
                  Pay $5
                </button>
              </div>
            </div>
            {note ? <p className="mt-3 text-sm text-leaf">{note}</p> : null}
            <ClosetRow label="Hats" items={HATS} slot="hat" shop={shop} growth={growth} grown={grown} onWear={wear} onBuy={buy} />
            <ClosetRow label="Sunglasses" items={GLASSES} slot="glasses" shop={shop} growth={growth} grown={grown} onWear={wear} onBuy={buy} />
            <ClosetRow label="Clothes" items={CLOTHES} slot="clothes" shop={shop} growth={growth} grown={grown} onWear={wear} onBuy={buy} />
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {AVATAR_STAGES.map((stage) => {
          const reached = growth >= stage.need
          const current = stage.id === now.id
          return (
            <div
              key={stage.id}
              className={`rounded-[24px] border px-3 py-4 text-center ${
                current ? 'border-[#1f6b45]/30 bg-[#e7f7ee]' : 'border-white/80 bg-white/75'
              }`}
            >
              {stage.id === 'adult' && grown ? (
                <KaleDressup src={stage.src} alt={stage.label} outfit={outfit} compact />
              ) : (
                <img
                  src={stage.src}
                  alt={stage.label}
                  className={`mx-auto h-24 w-24 object-contain ${reached ? '' : 'opacity-35 grayscale'}`}
                />
              )}
              <p className="mt-2 text-sm font-semibold text-ink">{stage.label}</p>
              <p className="mt-1 text-xs text-mist">{stage.need === 0 ? 'Start' : stage.need + ' points'}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function slotOf(item) {
  if (HATS.some((row) => row.id === item.id)) return 'hat'
  if (GLASSES.some((row) => row.id === item.id)) return 'glasses'
  return 'clothes'
}

function ClosetRow({ label, items, slot, shop, growth, grown, onWear, onBuy }) {
  return (
    <div className="mt-5 text-left">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const selected = shop[slot] === item.id
          const owned = itemOwned(shop, item.id)
          const earned = itemEarned(item, growth)
          const ready = owned || earned
          const remain = Math.max(0, (item.need || 0) - afterAdult(growth))
          return (
            <div key={item.id} className={`rounded-2xl border px-3 py-3 ${selected ? 'border-[#1f6b45]/30 bg-[#e7f7ee]' : 'border-[#efe8dc] bg-[#fffdf8]'}`}>
              <button
                type="button"
                disabled={!grown || !ready}
                onClick={() => onWear(slot, item)}
                className="w-full text-left disabled:cursor-not-allowed"
              >
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <p className="mt-1 text-xs text-mist">
                  {!grown
                    ? 'Adult only'
                    : ready
                      ? selected
                        ? 'Wearing'
                        : owned && !earned && item.id !== 'none'
                          ? 'Bought'
                          : 'Ready'
                      : remain + ' more exercise' + (remain === 1 ? '' : 's')}
                </p>
              </button>
              {grown && !ready && item.price > 0 ? (
                <button
                  type="button"
                  onClick={() => onBuy(item)}
                  className="mt-2 w-full rounded-full bg-[#24352d] px-2 py-1.5 text-xs font-semibold text-white"
                >
                  Buy {money(item.price)}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

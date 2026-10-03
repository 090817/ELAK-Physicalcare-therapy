const STORAGE_BASE = 'elak-kale-outfit-v1'
const ADULT_AT = 12
const EARN_EACH = 0.4

export const EMPTY_OUTFIT = { hat: 'none', glasses: 'none', clothes: 'none' }

export const HATS = [
  { id: 'none', label: 'None', need: 0, price: 0 },
  { id: 'beanie', label: 'Beanie', need: 0, price: 1.5 },
  { id: 'cap', label: 'Cap', need: 1, price: 2 },
  { id: 'sun', label: 'Sun hat', need: 2, price: 2.5 },
  { id: 'bow', label: 'Bow', need: 2, price: 2 },
  { id: 'flower', label: 'Flower', need: 3, price: 2.5 },
  { id: 'beret', label: 'Beret', need: 4, price: 3 },
  { id: 'crown', label: 'Crown', need: 6, price: 5 },
]

export const GLASSES = [
  { id: 'none', label: 'None', need: 0, price: 0 },
  { id: 'round', label: 'Round', need: 0, price: 2 },
  { id: 'square', label: 'Square', need: 1, price: 2 },
  { id: 'visor', label: 'Visor', need: 2, price: 2.5 },
  { id: 'heart', label: 'Hearts', need: 3, price: 3 },
  { id: 'star', label: 'Stars', need: 4, price: 3.5 },
  { id: 'cateye', label: 'Cat eye', need: 5, price: 4 },
]

export const CLOTHES = [
  { id: 'none', label: 'None', need: 0, price: 0 },
  { id: 'tee', label: 'Tee', need: 0, price: 2 },
  { id: 'scarf', label: 'Scarf', need: 1, price: 2 },
  { id: 'hoodie', label: 'Hoodie', need: 2, price: 3.5 },
  { id: 'sweater', label: 'Sweater', need: 3, price: 3 },
  { id: 'jacket', label: 'Jacket', need: 3, price: 4 },
  { id: 'vest', label: 'Vest', need: 4, price: 3.5 },
  { id: 'overalls', label: 'Overalls', need: 5, price: 4.5 },
  { id: 'raincoat', label: 'Raincoat', need: 6, price: 5 },
  { id: 'cape', label: 'Cape', need: 8, price: 6 },
]

const CATALOG = [...HATS, ...GLASSES, ...CLOTHES]

function closetUser() {
  try {
    return (new URLSearchParams(window.location.search).get('user') || 'guest').trim().toLowerCase()
  } catch {
    return 'guest'
  }
}

function storageKey() {
  return `${STORAGE_BASE}:${closetUser()}`
}

function knownId(id) {
  return CATALOG.some((item) => item.id === id) || id === 'none'
}

export function emptyShop() {
  return {
    ...EMPTY_OUTFIT,
    owned: ['none'],
    wallet: 0,
    earned: 0,
  }
}

export function readShop() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || 'null')
    if (!parsed || typeof parsed !== 'object') return emptyShop()
    const owned = Array.isArray(parsed.owned)
      ? parsed.owned.filter(knownId)
      : ['none']
    if (!owned.includes('none')) owned.unshift('none')
    return {
      hat: knownId(parsed.hat) ? parsed.hat : 'none',
      glasses: knownId(parsed.glasses) ? parsed.glasses : 'none',
      clothes: knownId(parsed.clothes) ? parsed.clothes : 'none',
      owned,
      wallet: Math.max(0, Number(parsed.wallet) || 0),
      earned: Math.max(0, Number(parsed.earned) || 0),
    }
  } catch {
    return emptyShop()
  }
}

export function writeShop(shop) {
  localStorage.setItem(storageKey(), JSON.stringify(shop))
  return shop
}

export function afterAdult(growth) {
  return Math.max(0, Math.floor(Number(growth) || 0) - ADULT_AT)
}

export function itemById(id) {
  return CATALOG.find((item) => item.id === id) || null
}

export function itemOwned(shop, id) {
  return id === 'none' || (shop.owned || []).includes(id)
}

export function itemEarned(item, growth) {
  return !item || item.id === 'none' || afterAdult(growth) >= (item.need || 0)
}

export function itemReady(shop, item, growth) {
  return itemOwned(shop, item.id) || itemEarned(item, growth)
}

export function money(n) {
  const v = Math.max(0, Number(n) || 0)
  return '$' + v.toFixed(2).replace(/\.00$/, '')
}

export function syncShopEarn(shop, growth) {
  const should = afterAdult(growth) * EARN_EACH
  const extra = Math.max(0, +(should - (shop.earned || 0)).toFixed(2))
  if (!extra) return shop
  return writeShop({
    ...shop,
    earned: +((shop.earned || 0) + extra).toFixed(2),
    wallet: +((shop.wallet || 0) + extra).toFixed(2),
  })
}

export function addMoney(shop, amount) {
  const add = Math.max(0, Number(amount) || 0)
  return writeShop({ ...shop, wallet: +((shop.wallet || 0) + add).toFixed(2) })
}

export function buyItem(shop, id) {
  const item = itemById(id)
  if (!item || item.id === 'none') return { shop, error: 'none' }
  if (itemOwned(shop, id)) return { shop, error: 'owned' }
  if ((shop.wallet || 0) < item.price) return { shop, error: 'money' }
  const owned = [...new Set([...(shop.owned || []), id])]
  const next = writeShop({
    ...shop,
    owned,
    wallet: +((shop.wallet || 0) - item.price).toFixed(2),
  })
  return { shop: next, error: null }
}

export function wearItem(shop, slot, id) {
  return writeShop({ ...shop, [slot]: id })
}

export function outfitOf(shop) {
  return { hat: shop.hat || 'none', glasses: shop.glasses || 'none', clothes: shop.clothes || 'none' }
}

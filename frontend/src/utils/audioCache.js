const DB_NAME = 'mv-audio'
const STORE = 'tracks'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

export async function getCachedAudio(trackId) {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(String(trackId))
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

export async function cacheAudio(trackId, arrayBuffer) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(arrayBuffer, String(trackId))
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}

export async function isAudioCached(trackId) {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).count(String(trackId))
      req.onsuccess = () => resolve(req.result > 0)
      req.onerror = () => resolve(false)
    })
  } catch { return false }
}

export async function deleteCachedAudio(trackId) {
  try {
    const db = await openDB()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(String(trackId))
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
  } catch {}
}

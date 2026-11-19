import { useCallback, useSyncExternalStore } from 'react'
import { store, type AppStore, type AppStoreSnapshot } from './store'

export function useAppStore(targetStore: AppStore = store): AppStoreSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => targetStore.subscribe(listener),
    [targetStore]
  )
  const getSnapshot = useCallback(() => targetStore.getSnapshot(), [targetStore])
  const getServerSnapshot = useCallback(() => targetStore.getServerSnapshot(), [targetStore])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

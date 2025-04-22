import { create } from 'zustand'
import { SpaceTimeObject } from './types'

interface SpaceTimeStore {
  objects: SpaceTimeObject[]
  addObject: (object: SpaceTimeObject) => void
  updateObject: (object: SpaceTimeObject) => void
  removeObject: (id: string) => void
}

export const useSpaceTimeStore = create<SpaceTimeStore>((set) => ({
  objects: [],
  addObject: (object) => set((state) => ({ objects: [...state.objects, object] })),
  updateObject: (object) =>
    set((state) => ({
      objects: state.objects.map((obj) => (obj.id === object.id ? object : obj)),
    })),
  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
    })),
})) 
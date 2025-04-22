export enum ObjectType {
  Planet = 'planet',
  BlackHole = 'blackhole'
}

export interface SpaceTimeObject {
  id: string
  type: ObjectType
  position: [number, number, number]
  velocity: [number, number, number]
  mass: number
  radius: number
} 
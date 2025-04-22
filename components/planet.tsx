import { useRef } from 'react'
import { SpaceTimeObject } from '@/lib/types'
import * as THREE from 'three'

interface PlanetProps {
  object: SpaceTimeObject
}

export default function Planet({ object }: PlanetProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [x, y, z] = object.position

  return (
    <mesh ref={meshRef} position={[x, y, z]}>
      <sphereGeometry args={[object.radius, 32, 32]} />
      <meshStandardMaterial
        color={0x00ff00}
        emissive={0x00ff00}
        emissiveIntensity={0.5}
      />
    </mesh>
  )
} 
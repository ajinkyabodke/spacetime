import { useRef } from 'react'
import { SpaceTimeObject } from '@/lib/types'
import * as THREE from 'three'

interface BlackHoleProps {
  object: SpaceTimeObject
}

export default function BlackHole({ object }: BlackHoleProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [x, y, z] = object.position

  return (
    <mesh ref={meshRef} position={[x, y, z]}>
      <sphereGeometry args={[object.radius, 32, 32]} />
      <meshBasicMaterial color={0x000000} />
      <mesh position={[0, 0, 0.1]}>
        <ringGeometry args={[object.radius * 0.8, object.radius * 1.2, 32]} />
        <meshBasicMaterial
          color={0x00ff00}
          side={THREE.DoubleSide}
          transparent
          opacity={0.5}
        />
      </mesh>
    </mesh>
  )
} 
"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { useSpaceTimeStore } from "@/lib/store"
import { ObjectType } from "@/lib/types"
import * as THREE from "three"
import Planet from "./planet"
import BlackHole from "./black-hole"

export default function SpaceTimeFabric() {
  const { objects, updateObject, removeObject } = useSpaceTimeStore()
  const gridSize = 20
  const gridDivisions = 20
  const fabricRef = useRef<THREE.Mesh>(null)
  const fabricGeometryRef = useRef<THREE.PlaneGeometry>(null)
  const gridRef = useRef<THREE.GridHelper>(null)

  // Create a much simpler material with very obvious green lines
  const fabricMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: false,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    })
  }, [])

  // Create a separate grid for the green lines
  const gridHelper = useMemo(() => {
    // Create a grid helper with thick green lines
    const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x000000, 0x00ff00)

    // Make the grid lines much thicker
    const material = grid.material as THREE.LineBasicMaterial
    material.color.set(0x00ff00)
    material.linewidth = 10 // Note: linewidth only works in some browsers

    // Modify the grid geometry to make lines thicker
    const geometry = grid.geometry
    const edgesGeometry = new THREE.EdgesGeometry(
      new THREE.PlaneGeometry(gridSize, gridSize, gridDivisions, gridDivisions),
    )
    const edges = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 }))

    return edges
  }, [])

  // Enhance the deformation calculation to make curvature more visible
  useFrame(() => {
    if (!fabricRef.current || !fabricGeometryRef.current || !gridRef.current) return

    const geometry = fabricGeometryRef.current
    const positions = geometry.attributes.position.array as Float32Array

    // Also get the grid positions
    const gridGeometry = gridRef.current.geometry
    const gridPositions = gridGeometry.attributes.position.array as Float32Array

    // Reset positions
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = 0 // Reset y position
    }

    // Reset grid positions
    for (let i = 0; i < gridPositions.length; i += 3) {
      gridPositions[i + 1] = 0 // Reset y position
    }

    // Apply gravitational deformation with enhanced effect
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 2]

      for (const obj of objects) {
        const [objX, objY, objZ] = obj.position
        const dx = x - objX
        const dz = z - objZ
        const distance = Math.sqrt(dx * dx + dz * dz)

        // Skip if too far - increased range for wider effect
        if (distance > obj.mass * 4) continue

        // Calculate deformation based on mass and distance - enhanced effect
        const deformation = (obj.mass * 2.0) / (distance + 0.2)
        positions[i + 1] -= deformation
      }
    }

    // Apply the same deformation to the grid
    for (let i = 0; i < gridPositions.length; i += 3) {
      const x = gridPositions[i]
      const z = gridPositions[i + 2]

      for (const obj of objects) {
        const [objX, objY, objZ] = obj.position
        const dx = x - objX
        const dz = z - objZ
        const distance = Math.sqrt(dx * dx + dz * dz)

        // Skip if too far
        if (distance > obj.mass * 4) continue

        // Calculate deformation based on mass and distance
        const deformation = (obj.mass * 2.0) / (distance + 0.2)
        gridPositions[i + 1] -= deformation
      }
    }

    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()

    gridGeometry.attributes.position.needsUpdate = true
  })

  // Handle physics interactions between objects
  useFrame(() => {
    const objectsToRemove: string[] = []
    const updatedObjects = [...objects]

    // Update positions based on velocity
    for (let i = 0; i < updatedObjects.length; i++) {
      const obj = updatedObjects[i]
      const [vx, vy, vz] = obj.velocity
      const [px, py, pz] = obj.position

      // Update position based on velocity
      obj.position = [px + vx * 0.01, py + vy * 0.01, pz + vz * 0.01]

      // Apply gravity from other objects
      for (let j = 0; j < updatedObjects.length; j++) {
        if (i === j) continue

        const other = updatedObjects[j]
        const [ox, oy, oz] = other.position
        const dx = ox - px
        const dy = oy - py
        const dz = oz - pz
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        // Skip if too far
        if (distance > 10) continue

        // Calculate gravitational force
        const forceMagnitude = (other.mass * 0.1) / (distance * distance)
        const fx = (dx / distance) * forceMagnitude
        const fy = (dy / distance) * forceMagnitude
        const fz = (dz / distance) * forceMagnitude

        // Apply force to velocity
        obj.velocity = [vx + fx, vy + fy, vz + fz]

        // Handle collisions
        if (distance < obj.radius + other.radius) {
          // Black hole consumes other objects
          if (other.type === ObjectType.BlackHole) {
            objectsToRemove.push(obj.id)
            break
          }
          // Planet-planet collision
          else if (obj.type === ObjectType.Planet && other.type === ObjectType.Planet) {
            // Simple elastic collision
            const m1 = obj.mass
            const m2 = other.mass
            const totalMass = m1 + m2

            // Merge velocities based on conservation of momentum
            const [v1x, v1y, v1z] = obj.velocity
            const [v2x, v2y, v2z] = other.velocity

            obj.velocity = [
              (v1x * (m1 - m2) + 2 * m2 * v2x) / totalMass,
              (v1y * (m1 - m2) + 2 * m2 * v2y) / totalMass,
              (v1z * (m1 - m2) + 2 * m2 * v2z) / totalMass,
            ]
          }
        }
      }

      // Remove objects that go too far from the fabric
      if (Math.abs(px) > gridSize || Math.abs(pz) > gridSize || py < -10 || py > 10) {
        objectsToRemove.push(obj.id)
      }

      updateObject(obj)
    }

    // Remove objects marked for deletion
    objectsToRemove.forEach((id) => removeObject(id))
  })

  return (
    <group rotation={[-Math.PI / 5, 0, 0]}>
      {/* Base fabric */}
      <mesh ref={fabricRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry ref={fabricGeometryRef} args={[gridSize, gridSize, gridDivisions, gridDivisions]} />
        <primitive object={fabricMaterial} attach="material" />
      </mesh>

      {/* Add explicit green grid lines */}
      <lineSegments ref={gridRef} rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(gridSize, gridSize, gridDivisions, gridDivisions)]} />
        <lineBasicMaterial color={0x00ff00} linewidth={3} />
      </lineSegments>

      {/* Add additional grid lines for extra thickness */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {Array.from({ length: gridDivisions + 1 }).map((_, i) => {
          const pos = (i / gridDivisions) * gridSize - gridSize / 2
          return (
            <group key={`grid-x-${i}`}>
              {/* Horizontal lines */}
              <mesh position={[0, pos, 0.01]}>
                <boxGeometry args={[gridSize, 0.1, 0.01]} />
                <meshBasicMaterial color={0x00ff00} />
              </mesh>
              {/* Vertical lines */}
              <mesh position={[pos, 0, 0.01]}>
                <boxGeometry args={[0.1, gridSize, 0.01]} />
                <meshBasicMaterial color={0x00ff00} />
              </mesh>
            </group>
          )
        })}
      </group>

      {objects.map((object) =>
        object.type === ObjectType.Planet ? (
          <Planet key={object.id} object={object} />
        ) : (
          <BlackHole key={object.id} object={object} />
        ),
      )}
    </group>
  )
} 
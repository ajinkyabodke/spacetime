"use client";

import { Grid, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGesture } from "@use-gesture/react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface GridPoint {
  position: [number, number, number];
  originalY: number;
}

interface CelestialObject {
  id: number;
  type: "planet" | "blackHole";
  position: [number, number, number];
  mass: number;
  radius: number;
  velocity: [number, number, number];
}

interface SpaceTimeGridProps {
  objects: CelestialObject[];
  onPlaneReady: (mesh: THREE.Mesh) => void;
}

function SpaceTimeGrid({ objects, onPlaneReady }: SpaceTimeGridProps) {
  const gridRef = useRef<THREE.Mesh>(null);
  const [gridPoints, setGridPoints] = useState<GridPoint[]>([]);

  // Initialize grid points
  useEffect(() => {
    const points: GridPoint[] = [];
    const size = 20;
    const segments = 200;

    for (let i = -size / 2; i <= size / 2; i += size / segments) {
      for (let j = -size / 2; j <= size / 2; j += size / segments) {
        points.push({
          position: [i, 0, j],
          originalY: 0,
        });
      }
    }

    setGridPoints(points);
  }, []);

  // Inform parent once the plane is created, so CelestialObjects can sample it
  useEffect(() => {
    if (gridRef.current) {
      onPlaneReady(gridRef.current);
    }
  }, [gridRef.current]);

  // Update grid points based on objects
  useFrame(() => {
    if (!gridRef.current) return;

    const positions = (
      gridRef.current.geometry.attributes.position as THREE.BufferAttribute
    ).array;

    // Single loop for both reset and distortion
    for (let i = 0; i < positions.length; i += 3) {
      const pointIndex = i / 3;
      const point = gridPoints[pointIndex];
      if (!point) continue;

      const x = point.position[0];
      const z = point.position[2];
      let newY = point.originalY;

      // Calculate distortion from all objects
      objects.forEach((obj) => {
        const objPos = obj.position;
        const objMass = obj.mass || 1;
        const objType = obj.type || "planet";
        const distortionFactor = objType === "blackHole" ? 10 : 1;

        // Horizontal distance only
        const dx = x - objPos[0];
        const dz = z - objPos[2];
        const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

        // Exponential falloff
        const falloff = Math.exp(
          -horizontalDistance * horizontalDistance * 0.3
        );
        const distortion = -objMass * distortionFactor * falloff;
        newY += distortion;
      });

      positions[i] = x;
      positions[i + 1] = newY;
      positions[i + 2] = z;
    }

    gridRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <mesh ref={gridRef} rotation={[0, 0, 0]}>
      <planeGeometry args={[20, 20, 200, 200]} />
      <meshBasicMaterial color={0x00ff00} wireframe side={THREE.DoubleSide} />
    </mesh>
  );
}

interface CelestialObjectProps {
  id: number;
  type: "planet" | "blackHole";
  position: [number, number, number];
  mass: number;
  radius: number;
  velocity: [number, number, number];
  onDelete: () => void;
  onPositionChange: (newPosition: [number, number, number]) => void;
  objects: CelestialObject[];
  controlsRef: React.RefObject<OrbitControlsImpl>;
  planeMesh: THREE.Mesh | null;
}

function CelestialObject({
  id,
  type,
  position,
  mass,
  radius,
  velocity,
  onDelete,
  onPositionChange,
  objects,
  controlsRef,
  planeMesh,
}: CelestialObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);
  const { camera, gl } = useThree();
  const lastDragPosition = useRef<THREE.Vector3 | null>(null);

  const properties = {
    planet: {
      color: 0x3498db,
      mass: 1,
      radius: 1,
      emissiveIntensity: 0.5,
    },
    blackHole: {
      color: 0x000000,
      mass: 3,
      radius: 2,
      emissiveIntensity: 2.0,
    },
  };
  const props = properties[type] || properties.planet;

  // Helper: sample the plane geometry at (x,z) to get the actual Y
  const getPlaneY = (x: number, z: number): number => {
    if (!planeMesh) return 0;
    const posAttr = planeMesh.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    let closestDist = Infinity;
    let closestY = 0;

    for (let i = 0; i < arr.length; i += 3) {
      const vx = arr[i];
      const vy = arr[i + 1];
      const vz = arr[i + 2];

      const dx = vx - x;
      const dz = vz - z;
      const distSq = dx * dx + dz * dz;
      if (distSq < closestDist) {
        closestDist = distSq;
        closestY = vy;
      }
    }
    return closestY;
  };

  useFrame(() => {
    if (!meshRef.current) return;
    const [x, , z] = position;
    const planeY = getPlaneY(x, z);
    meshRef.current.position.set(x, planeY + props.radius, z);
  });

  const bind = useGesture(
    {
      onDragStart: () => {
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
      },
      onDrag: ({ event, memo }) => {
        event.stopPropagation();

        if (!memo) {
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0));
          const planeIntersectPoint = new THREE.Vector3();
          return { plane, planeIntersectPoint };
        }

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        if ("offsetX" in event) {
          mouse.x = (event.offsetX / gl.domElement.clientWidth) * 2 - 1;
          mouse.y = -(event.offsetY / gl.domElement.clientHeight) * 2 + 1;
        }

        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(memo.plane, memo.planeIntersectPoint);

        lastDragPosition.current = memo.planeIntersectPoint.clone();

        onPositionChange([
          memo.planeIntersectPoint.x,
          0,
          memo.planeIntersectPoint.z,
        ]);

        return memo;
      },
      onDragEnd: () => {
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
      },
    },
    {
      drag: {
        filterTaps: true,
        threshold: 5,
      },
    }
  );

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[position[0], position[1], position[2]]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setHovered(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          setSelected(!selected);
        }}
        {...bind()}
      >
        <sphereGeometry args={[props.radius, 32, 32]} />
        <meshStandardMaterial
          color={props.color}
          emissive={type === "blackHole" ? 0x222222 : props.color}
          emissiveIntensity={props.emissiveIntensity}
          metalness={type === "blackHole" ? 1.0 : 0.5}
          roughness={type === "blackHole" ? 0.0 : 0.5}
        />
      </mesh>
      {selected && (
        <Html
          position={[position[0], position[1] + props.radius + 1, position[2]]}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="bg-red-500 text-white px-2 py-1 rounded text-sm"
          >
            Delete
          </button>
        </Html>
      )}
    </group>
  );
}

export default function Home() {
  const [objects, setObjects] = useState<CelestialObject[]>([]);
  const [selectedSize, setSelectedSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [planeMesh, setPlaneMesh] = useState<THREE.Mesh | null>(null);

  const sizeProperties = {
    small: { radius: 0.3, mass: 0.5 },
    medium: { radius: 0.8, mass: 1.5 },
    large: { radius: 1.5, mass: 3 },
  };

  const handlePlaneReady = (mesh: THREE.Mesh) => {
    setPlaneMesh(mesh);
  };

  const addObject = (type: "planet" | "blackHole") => {
    const planeY = planeMesh
      ? (() => {
          const posAttr = planeMesh.geometry.attributes
            .position as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          return arr[1];
        })()
      : 0;

    const sizeProps = sizeProperties[selectedSize];
    const mass = type === "blackHole" ? sizeProps.mass * 5 : sizeProps.mass; // Black holes have more mass for their size

    const newObject: CelestialObject = {
      id: Date.now(),
      type,
      position: [0, planeY, 0],
      mass,
      radius: sizeProps.radius,
      velocity: [0, 0, 0],
    };

    setObjects((prevObjects) => [...prevObjects, newObject]);
  };

  const removeObject = (id: number) => {
    setObjects(objects.filter((obj) => obj.id !== id));
  };

  const updateObjectPosition = (
    id: number,
    newPosition: [number, number, number]
  ) => {
    setObjects(
      objects.map((obj) =>
        obj.id === id ? { ...obj, position: newPosition } : obj
      )
    );
  };

  return (
    <div className="flex w-screen h-screen">
      <div className="w-64 bg-black border-r border-green-500 p-4 text-green-500">
        <h2 className="text-xl font-bold mb-4">Space-Time Fabric Simulator</h2>
        <div className="mb-6">
          <h3 className="text-lg mb-2">Object Size</h3>
          <div className="space-y-2">
            <button
              className={`w-full p-2 rounded border ${
                selectedSize === "small" ? "bg-green-800" : "bg-green-900"
              } border-green-500 hover:bg-green-800`}
              onClick={() => setSelectedSize("small")}
            >
              Small (Radius: 0.3)
            </button>
            <button
              className={`w-full p-2 rounded border ${
                selectedSize === "medium" ? "bg-green-800" : "bg-green-900"
              } border-green-500 hover:bg-green-800`}
              onClick={() => setSelectedSize("medium")}
            >
              Medium (Radius: 0.8)
            </button>
            <button
              className={`w-full p-2 rounded border ${
                selectedSize === "large" ? "bg-green-800" : "bg-green-900"
              } border-green-500 hover:bg-green-800`}
              onClick={() => setSelectedSize("large")}
            >
              Large (Radius: 1.5)
            </button>
          </div>
        </div>
        <div className="mb-6">
          <h3 className="text-lg mb-2">Add Objects</h3>
          <button
            className="w-full bg-green-900 text-green-500 p-2 mb-2 rounded border border-green-500 hover:bg-green-800"
            onClick={() => addObject("planet")}
          >
            Add Planet
          </button>
          <button
            className="w-full bg-green-900 text-green-500 p-2 rounded border border-green-500 hover:bg-green-800"
            onClick={() => addObject("blackHole")}
          >
            Add Black Hole
          </button>
        </div>
        <div>
          <h3 className="text-lg mb-2">Instructions</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Click buttons to add objects</li>
            <li>Click on objects to remove them</li>
            <li>Drag objects to move them</li>
            <li>Drag to orbit the scene</li>
            <li>Scroll to zoom in/out</li>
            <li>Right-click and drag to pan</li>
            <li>Watch how objects deform space-time</li>
          </ul>
        </div>
      </div>

      <main className="flex-1">
        <Canvas camera={{ position: [0, 5, 15], fov: 50 }}>
          <color attach="background" args={["#000"]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />

          {/* Space-time fabric grid */}
          <SpaceTimeGrid objects={objects} onPlaneReady={handlePlaneReady} />

          {/* Additional grid for aesthetics (optional) */}
          <Grid
            args={[20, 20]}
            position={[0, 0, 0]}
            cellSize={0.5}
            cellThickness={0.3}
            cellColor="#00ff00"
            sectionSize={2.5}
            sectionThickness={0.8}
            sectionColor="#00ff00"
            fadeDistance={30}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid={false}
          />

          {/* Celestial objects */}
          {objects.map((obj) => (
            <CelestialObject
              key={obj.id}
              id={obj.id}
              type={obj.type}
              position={obj.position}
              mass={obj.mass}
              radius={obj.radius}
              velocity={obj.velocity}
              onDelete={() => removeObject(obj.id)}
              onPositionChange={(newPosition) =>
                updateObjectPosition(obj.id, newPosition)
              }
              objects={objects}
              controlsRef={controlsRef}
              planeMesh={planeMesh}
            />
          ))}

          <OrbitControls
            ref={controlsRef}
            enableDamping={true}
            dampingFactor={0.05}
            rotateSpeed={0.5}
            minDistance={5}
            maxDistance={50}
            enablePan={true}
            enableZoom={true}
            screenSpacePanning={false}
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={0.1}
            maxAzimuthAngle={Infinity}
            minAzimuthAngle={-Infinity}
            target={[0, 0, 0]}
            makeDefault
          />
        </Canvas>
      </main>
    </div>
  );
}

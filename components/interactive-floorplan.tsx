"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, TransformControls, Text } from "@react-three/drei"
import { useState, useRef, useCallback, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import * as THREE from "three"

interface Issue {
  id: number
  area: string
  problem: string
  hint: string
  position: { x: number; y: number }
  severity: "critical" | "high" | "medium"
}

interface InteractiveFloorplanProps {
  selectedTool: string
  issues: Issue[]
  onIssueClick: (issueId: number) => void
  selectedIssueId: number | null
}

// Realistic 2BHK floorplan data with proper proportions (in meters)
const floorplanData = {
  rooms: [
    {
      id: "living-room",
      name: "Living Room",
      position: [2, 1.5, 0],
      size: [4, 3, 0.02],
      dimensions: "13' × 10'",
      color: "#f5f5f5", // light grey
    },
    {
      id: "kitchen",
      name: "Kitchen",
      position: [6.5, 1.5, 0],
      size: [3, 3, 0.02],
      dimensions: "10' × 10'",
      color: "#f0f8f0", // pale green
    },
    {
      id: "master-bedroom",
      name: "Master Bedroom",
      position: [2, -2.5, 0],
      size: [4, 3, 0.02],
      dimensions: "13' × 10'",
      color: "#faf5f0", // light beige
    },
    {
      id: "bedroom-2",
      name: "Bedroom 2",
      position: [6.5, -2.5, 0],
      size: [3, 3, 0.02],
      dimensions: "10' × 10'",
      color: "#faf5f0", // light beige
    },
    {
      id: "master-bathroom",
      name: "Master Bath",
      position: [0.75, -2.5, 0],
      size: [1.5, 2, 0.02],
      dimensions: "5' × 6'",
      color: "#f0f8ff", // light blue
    },
    {
      id: "common-bathroom",
      name: "Bathroom",
      position: [4.75, 0.25, 0],
      size: [1.5, 1.5, 0.02],
      dimensions: "5' × 5'",
      color: "#f0f8ff", // light blue
    },
    {
      id: "hallway",
      name: "Hallway",
      position: [4, -0.5, 0],
      size: [1, 4, 0.02],
      dimensions: "3' × 13'",
      color: "#f8f8f8", // very light grey
    },
  ],
  walls: [
    // Outer walls (thicker)
    { id: "wall-outer-1", start: [0, -4, 0], end: [8, -4, 0], thickness: 0.2, height: 2.5, type: "outer" },
    { id: "wall-outer-2", start: [8, -4, 0], end: [8, 3, 0], thickness: 0.2, height: 2.5, type: "outer" },
    { id: "wall-outer-3", start: [8, 3, 0], end: [0, 3, 0], thickness: 0.2, height: 2.5, type: "outer" },
    { id: "wall-outer-4", start: [0, 3, 0], end: [0, -4, 0], thickness: 0.2, height: 2.5, type: "outer" },

    // Interior walls (thinner)
    { id: "wall-int-1", start: [4, -4, 0], end: [4, 3, 0], thickness: 0.1, height: 2.5, type: "interior" },
    { id: "wall-int-2", start: [0, -1, 0], end: [4, -1, 0], thickness: 0.1, height: 2.5, type: "interior" },
    { id: "wall-int-3", start: [5, 3, 0], end: [5, 1, 0], thickness: 0.1, height: 2.5, type: "interior" },
    { id: "wall-int-4", start: [5, 1, 0], end: [8, 1, 0], thickness: 0.1, height: 2.5, type: "interior" },
    { id: "wall-int-5", start: [1.5, -1, 0], end: [1.5, -4, 0], thickness: 0.1, height: 2.5, type: "interior" },
  ],
  doors: [
    { id: "door-main", position: [0, 1.5, 0], rotation: [0, 0, 0], size: [0.1, 0.8, 2], type: "main", swing: "right" },
    {
      id: "door-living",
      position: [4, 0.5, 0],
      rotation: [0, 0, Math.PI / 2],
      size: [0.8, 0.1, 2],
      type: "interior",
      swing: "left",
    },
    {
      id: "door-kitchen",
      position: [5, 2, 0],
      rotation: [0, 0, 0],
      size: [0.1, 0.8, 2],
      type: "interior",
      swing: "right",
    },
    {
      id: "door-master",
      position: [1.5, -2, 0],
      rotation: [0, 0, Math.PI / 2],
      size: [0.8, 0.1, 2],
      type: "interior",
      swing: "left",
    },
    {
      id: "door-bedroom2",
      position: [5.5, -1, 0],
      rotation: [0, 0, 0],
      size: [0.1, 0.8, 2],
      type: "interior",
      swing: "right",
    },
    {
      id: "door-masterbath",
      position: [1.5, -1.5, 0],
      rotation: [0, 0, Math.PI / 2],
      size: [0.8, 0.1, 2],
      type: "interior",
      swing: "left",
    },
    {
      id: "door-bathroom",
      position: [4.5, 1, 0],
      rotation: [0, 0, 0],
      size: [0.1, 0.8, 2],
      type: "interior",
      swing: "right",
    },
  ],
  windows: [
    { id: "window-living", position: [2, 3, 1], size: [2, 0.1, 1], type: "large" },
    { id: "window-master", position: [2, -4, 1], size: [2, 0.1, 1], type: "large" },
    { id: "window-bedroom2", position: [8, -2.5, 1], size: [0.1, 1.5, 1], type: "medium" },
    { id: "window-kitchen", position: [6.5, 3, 1], size: [1.5, 0.1, 1], type: "medium" },
  ],
  fixtures: [
    // Kitchen fixtures
    { id: "kitchen-counter", position: [7, 2.5, 0.4], size: [2, 0.6, 0.8], color: "#d4d4d4", type: "counter" },
    { id: "kitchen-sink", position: [6.2, 2.8, 0.4], size: [0.6, 0.4, 0.2], color: "#e8e8e8", type: "sink" },

    // Bathroom fixtures
    { id: "toilet-master", position: [0.3, -3.2, 0.2], size: [0.4, 0.6, 0.4], color: "#ffffff", type: "toilet" },
    { id: "sink-master", position: [1.2, -3.5, 0.4], size: [0.5, 0.3, 0.2], color: "#ffffff", type: "sink" },
    { id: "toilet-common", position: [4.2, 0.8, 0.2], size: [0.4, 0.6, 0.4], color: "#ffffff", type: "toilet" },
    { id: "sink-common", position: [5.3, 0.8, 0.4], size: [0.5, 0.3, 0.2], color: "#ffffff", type: "sink" },
  ],
}

// Issue positions mapped to actual floorplan coordinates
const issuePositions = [
  { id: 1, worldPos: [6.5, 1.5, 1], screenOffset: { x: 0, y: -20 } }, // Kitchen ventilation
  { id: 2, worldPos: [6.5, -2.5, 1], screenOffset: { x: 0, y: -20 } }, // Bedroom 2 emergency exit
  { id: 3, worldPos: [4, -0.5, 1], screenOffset: { x: 0, y: -20 } }, // Narrow hallway
  { id: 4, worldPos: [2, 1.5, 1], screenOffset: { x: 0, y: -20 } }, // Living room lighting
  { id: 5, worldPos: [4.5, 1, 1], screenOffset: { x: 0, y: -20 } }, // Bathroom door to kitchen
]

function Room({ room, isSelected, onClick, selectedTool }: any) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  return (
    <group position={room.position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={room.size} />
        <meshStandardMaterial
          color={isSelected ? "#14b8a6" : hovered ? "#f0f0f0" : room.color}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Room outline */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[room.size[0], room.size[1]]} />
        <meshBasicMaterial color="#666" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Room label */}
      <Text position={[0, 0, 0.1]} fontSize={0.25} color="#333" anchorX="center" anchorY="middle">
        {room.name}
      </Text>
      <Text position={[0, -0.3, 0.1]} fontSize={0.15} color="#666" anchorX="center" anchorY="middle">
        {room.dimensions}
      </Text>

      {/* Selection outline */}
      {isSelected && (
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[room.size[0] + 0.1, room.size[1] + 0.1]} />
          <meshBasicMaterial color="#14b8a6" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function Wall({ wall, isSelected, onClick }: any) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const start = new THREE.Vector3(...wall.start)
  const end = new THREE.Vector3(...wall.end)
  const direction = end.clone().sub(start)
  const length = direction.length()
  const center = start.clone().add(direction.clone().multiplyScalar(0.5))
  const angle = Math.atan2(direction.y, direction.x)

  return (
    <group position={center.toArray()}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        rotation={[0, 0, angle]}
      >
        <boxGeometry args={[length, wall.thickness, wall.height]} />
        <meshStandardMaterial
          color={isSelected ? "#14b8a6" : hovered ? "#a0a0a0" : wall.type === "outer" ? "#8d8d8d" : "#b0b0b0"}
        />
      </mesh>

      {/* Selection outline */}
      {isSelected && (
        <mesh rotation={[0, 0, angle]} position={[0, 0, 0]}>
          <boxGeometry args={[length + 0.1, wall.thickness + 0.1, wall.height + 0.1]} />
          <meshBasicMaterial color="#14b8a6" transparent opacity={0.3} wireframe />
        </mesh>
      )}
    </group>
  )
}

function Door({ door, isSelected, onClick }: any) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  return (
    <group position={door.position} rotation={door.rotation}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={door.size} />
        <meshStandardMaterial
          color={isSelected ? "#14b8a6" : hovered ? "#a0522d" : door.type === "main" ? "#654321" : "#8B4513"}
        />
      </mesh>

      {/* Door swing arc */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0, 0.8, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#8B4513" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Selection outline */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[door.size[0] + 0.05, door.size[1] + 0.05, door.size[2] + 0.05]} />
          <meshBasicMaterial color="#14b8a6" transparent opacity={0.3} wireframe />
        </mesh>
      )}
    </group>
  )
}

function Window({ window, isSelected, onClick }: any) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  return (
    <group position={window.position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={window.size} />
        <meshStandardMaterial
          color={isSelected ? "#14b8a6" : hovered ? "#5f9ea0" : "#87CEEB"}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Window frame */}
      <mesh>
        <boxGeometry args={[window.size[0] + 0.05, window.size[1] + 0.05, window.size[2] + 0.1]} />
        <meshStandardMaterial color="#666" transparent opacity={0.8} />
      </mesh>

      {/* Selection outline */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[window.size[0] + 0.1, window.size[1] + 0.1, window.size[2] + 0.1]} />
          <meshBasicMaterial color="#14b8a6" transparent opacity={0.3} wireframe />
        </mesh>
      )}
    </group>
  )
}

function Fixture({ fixture, isSelected, onClick }: any) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  return (
    <group position={fixture.position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={fixture.size} />
        <meshStandardMaterial color={isSelected ? "#14b8a6" : hovered ? "#e0e0e0" : fixture.color} />
      </mesh>

      {/* Selection outline */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[fixture.size[0] + 0.05, fixture.size[1] + 0.05, fixture.size[2] + 0.05]} />
          <meshBasicMaterial color="#14b8a6" transparent opacity={0.3} wireframe />
        </mesh>
      )}
    </group>
  )
}

function IssueMarker({ issue, position, isSelected, onClick }: any) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.1
      meshRef.current.position.z = 1.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1
    }
  })

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444"
      case "high":
        return "#f97316"
      case "medium":
        return "#eab308"
      default:
        return "#6b7280"
    }
  }

  return (
    <group position={position.worldPos}>
      <mesh ref={meshRef} onClick={onClick} scale={isSelected ? 1.2 : 1}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? "#14b8a6" : getSeverityColor(issue.severity)}
          emissive={getSeverityColor(issue.severity)}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Issue number */}
      <Text position={[0, 0, 0.2]} fontSize={0.2} color="white" anchorX="center" anchorY="middle">
        {issue.id}
      </Text>

      {/* Pulsing ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.25, 16]} />
        <meshBasicMaterial color={getSeverityColor(issue.severity)} transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

function GridHelper() {
  return (
    <group>
      {/* Main grid */}
      <gridHelper args={[20, 40, "#e0e0e0", "#f0f0f0"]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Blueprint-style grid overlay */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.01]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#f8f9fa" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

function Scene({ selectedTool, onObjectSelect, selectedObject, issues, onIssueClick, selectedIssueId }: any) {
  const { camera } = useThree()

  useEffect(() => {
    // Set up orthographic top-down view
    camera.position.set(4, -0.5, 12)
    camera.lookAt(4, -0.5, 0)
    camera.updateProjectionMatrix()
  }, [camera])

  const handleObjectClick = useCallback(
    (objectId: string, objectType: string, objectRef?: any) => {
      if (selectedTool === "move" || selectedTool === "rotate") {
        onObjectSelect({ id: objectId, type: objectType, ref: objectRef })
      }
    },
    [selectedTool, onObjectSelect],
  )

  return (
    <>
      {/* Lighting setup */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, -10, 10]} intensity={0.4} />

      {/* Grid */}
      <GridHelper />

      {/* Rooms */}
      {floorplanData.rooms.map((room) => (
        <Room
          key={room.id}
          room={room}
          isSelected={selectedObject?.id === room.id}
          onClick={(e: any) => {
            e.stopPropagation()
            handleObjectClick(room.id, "room", e.object)
          }}
          selectedTool={selectedTool}
        />
      ))}

      {/* Walls */}
      {floorplanData.walls.map((wall) => (
        <Wall
          key={wall.id}
          wall={wall}
          isSelected={selectedObject?.id === wall.id}
          onClick={(e: any) => {
            e.stopPropagation()
            handleObjectClick(wall.id, "wall", e.object)
          }}
        />
      ))}

      {/* Doors */}
      {floorplanData.doors.map((door) => (
        <Door
          key={door.id}
          door={door}
          isSelected={selectedObject?.id === door.id}
          onClick={(e: any) => {
            e.stopPropagation()
            handleObjectClick(door.id, "door", e.object)
          }}
        />
      ))}

      {/* Windows */}
      {floorplanData.windows.map((window) => (
        <Window
          key={window.id}
          window={window}
          isSelected={selectedObject?.id === window.id}
          onClick={(e: any) => {
            e.stopPropagation()
            handleObjectClick(window.id, "window", e.object)
          }}
        />
      ))}

      {/* Fixtures */}
      {floorplanData.fixtures.map((fixture) => (
        <Fixture
          key={fixture.id}
          fixture={fixture}
          isSelected={selectedObject?.id === fixture.id}
          onClick={(e: any) => {
            e.stopPropagation()
            handleObjectClick(fixture.id, "fixture", e.object)
          }}
        />
      ))}

      {/* Issue Markers */}
      {issues.map((issue, index) => {
        const position = issuePositions.find((p) => p.id === issue.id)
        if (!position) return null

        return (
          <IssueMarker
            key={issue.id}
            issue={issue}
            position={position}
            isSelected={selectedIssueId === issue.id}
            onClick={(e: any) => {
              e.stopPropagation()
              onIssueClick(issue.id)
            }}
          />
        )
      })}

      {/* Transform Controls */}
      {selectedObject?.ref && (selectedTool === "move" || selectedTool === "rotate") && (
        <TransformControls
          object={selectedObject.ref}
          mode={selectedTool === "move" ? "translate" : "rotate"}
          showX={selectedTool === "move"}
          showY={selectedTool === "move"}
          showZ={false}
          space="local"
          size={0.8}
        />
      )}
    </>
  )
}

export function InteractiveFloorplan({
  selectedTool,
  issues,
  onIssueClick,
  selectedIssueId,
}: InteractiveFloorplanProps) {
  const [selectedObject, setSelectedObject] = useState<any>(null)

  const handleObjectSelect = useCallback((object: any) => {
    setSelectedObject(object)
  }, [])

  return (
    <div className="relative w-full h-full bg-gray-50">
      {/* Three.js Canvas */}
      <Canvas
        camera={{
          position: [4, -0.5, 12],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        style={{ background: "transparent" }}
        className="relative z-10"
        shadows
      >
        <Scene
          selectedTool={selectedTool}
          onObjectSelect={handleObjectSelect}
          selectedObject={selectedObject}
          issues={issues}
          onIssueClick={onIssueClick}
          selectedIssueId={selectedIssueId}
        />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={20}
          minDistance={5}
          target={[4, -0.5, 0]}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={Math.PI / 6}
        />
      </Canvas>

      {/* Status Badge */}
      <div className="absolute top-4 left-4 z-20">
        <Badge variant="destructive" className="bg-red-500 text-white font-semibold shadow-lg">
          {issues.length} Issues Found
        </Badge>
      </div>

      {/* Tool Instructions */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 border shadow-lg max-w-xs">
        <div className="text-sm font-semibold text-gray-800 mb-1">
          {selectedTool === "move" && "Move Tool Active"}
          {selectedTool === "rotate" && "Rotate Tool Active"}
          {selectedTool === "wall" && "Wall Drawing Tool"}
          {selectedTool === "door" && "Door/Window Placement"}
        </div>
        <div className="text-xs text-gray-600">
          {selectedTool === "move" && "Click and drag objects to reposition them"}
          {selectedTool === "rotate" && "Click and drag to rotate doors and fixtures"}
          {selectedTool === "wall" && "Click to start drawing new walls"}
          {selectedTool === "door" && "Click on walls to add doors or windows"}
        </div>
        {selectedObject && (
          <div className="text-xs text-teal-600 mt-2 font-medium">
            Selected: {selectedObject.type} ({selectedObject.id})
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 border shadow-lg">
        <div className="text-sm font-semibold text-gray-800 mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Critical Issues</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>High Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
            <span>Selected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

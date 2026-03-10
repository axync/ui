'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

function Shapes() {
  const group = useRef<THREE.Group>(null!)
  const { pointer } = useThree()

  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      t * 0.05 + pointer.x * 0.3,
      0.015
    )
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      Math.sin(t * 0.03) * 0.1 + pointer.y * 0.15,
      0.015
    )
  })

  const dots = useMemo(() => {
    const positions: { pos: [number, number, number]; size: number; color: string; opacity: number }[] = []
    const colors = ['#60A5FA', '#818CF8', '#CBD5E1', '#34D399', '#F59E0B']
    for (let i = 0; i < 50; i++) {
      const theta = (i / 50) * Math.PI * 2 * 3.5
      const r = 1.2 + i * 0.1
      positions.push({
        pos: [
          Math.cos(theta) * r * 0.7,
          (i / 50 - 0.5) * 7,
          Math.sin(theta) * r * 0.7 - 3,
        ],
        size: 0.02 + (i % 5) * 0.006,
        color: colors[i % 5],
        opacity: 0.25 + (i % 7) * 0.06,
      })
    }
    return positions
  }, [])

  return (
    <group ref={group}>
      {/* Large subtle wireframe backdrop */}
      <Float speed={0.3} rotationIntensity={0.8} floatIntensity={0.15}>
        <mesh position={[0, 0, -5]}>
          <icosahedronGeometry args={[4, 1]} />
          <meshStandardMaterial color="#CBD5E1" wireframe transparent opacity={0.025} />
        </mesh>
      </Float>

      {/* Primary icosahedron - blue */}
      <Float speed={1.1} rotationIntensity={0.5} floatIntensity={0.7}>
        <mesh position={[-3, 1.5, -1]}>
          <icosahedronGeometry args={[1.1, 1]} />
          <meshStandardMaterial color="#60A5FA" wireframe transparent opacity={0.1} />
        </mesh>
      </Float>

      {/* Octahedron - violet */}
      <Float speed={0.9} rotationIntensity={0.4} floatIntensity={0.9}>
        <mesh position={[3.5, -1, -2]}>
          <octahedronGeometry args={[0.75, 0]} />
          <meshStandardMaterial color="#818CF8" wireframe transparent opacity={0.13} />
        </mesh>
      </Float>

      {/* Dodecahedron - green */}
      <Float speed={1} rotationIntensity={0.7} floatIntensity={0.5}>
        <mesh position={[-1.5, -2.3, -3.5]}>
          <dodecahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color="#34D399" wireframe transparent opacity={0.09} />
        </mesh>
      </Float>

      {/* Tetrahedron - amber */}
      <Float speed={0.7} rotationIntensity={0.3} floatIntensity={1.1}>
        <mesh position={[2, 2.5, -4.5]}>
          <tetrahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#F59E0B" wireframe transparent opacity={0.07} />
        </mesh>
      </Float>

      {/* Small icosahedron - right side */}
      <Float speed={1.3} rotationIntensity={0.6} floatIntensity={0.6}>
        <mesh position={[4, 0.5, -3]}>
          <icosahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#60A5FA" wireframe transparent opacity={0.11} />
        </mesh>
      </Float>

      {/* Torus ring */}
      <Float speed={0.35} rotationIntensity={1.3} floatIntensity={0.15}>
        <mesh position={[0.5, -0.3, -7]}>
          <torusGeometry args={[2.5, 0.08, 16, 80]} />
          <meshStandardMaterial color="#818CF8" wireframe transparent opacity={0.035} />
        </mesh>
      </Float>

      {/* Second torus - perpendicular */}
      <Float speed={0.25} rotationIntensity={0.8} floatIntensity={0.1}>
        <mesh position={[-0.5, 0.2, -6]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
          <torusGeometry args={[2, 0.06, 16, 80]} />
          <meshStandardMaterial color="#60A5FA" wireframe transparent opacity={0.025} />
        </mesh>
      </Float>

      {/* Particle dots */}
      {dots.map((dot, i) => (
        <mesh key={i} position={dot.pos}>
          <sphereGeometry args={[dot.size, 6, 6]} />
          <meshBasicMaterial color={dot.color} transparent opacity={dot.opacity} />
        </mesh>
      ))}
    </group>
  )
}

export default function Scene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
      dpr={[1, 1.5]}
    >
      <fog attach="fog" args={['#08080C', 8, 22]} />
      <ambientLight intensity={0.08} />
      <pointLight position={[10, 8, 5]} intensity={0.35} color="#60A5FA" />
      <pointLight position={[-10, -5, -8]} intensity={0.2} color="#818CF8" />
      <pointLight position={[0, -10, 3]} intensity={0.1} color="#CBD5E1" />
      <Shapes />
    </Canvas>
  )
}

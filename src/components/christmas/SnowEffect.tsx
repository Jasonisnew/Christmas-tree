import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SnowEffectProps {
  active: boolean;
  count?: number;
}

export function SnowEffect({ active, count = 800 }: SnowEffectProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const velocitiesRef = useRef<Float32Array>();
  const activeRef = useRef(false);
  const opacityRef = useRef(0);

  // Initialize snowflake positions and velocities
  const { positions, initialPositions } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const initialPositions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Spread snowflakes in a wide area above the scene
      const x = (Math.random() - 0.5) * 30;
      const y = Math.random() * 20 + 5; // Start above the tree
      const z = (Math.random() - 0.5) * 30;
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      
      initialPositions[i3] = x;
      initialPositions[i3 + 1] = y;
      initialPositions[i3 + 2] = z;
      
      // Velocity: gentle downward with slight horizontal drift
      velocities[i3] = (Math.random() - 0.5) * 0.3; // x drift
      velocities[i3 + 1] = -(Math.random() * 1.5 + 0.5); // fall speed
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.3; // z drift
    }
    
    velocitiesRef.current = velocities;
    return { positions, initialPositions };
  }, [count]);

  // Snowflake sizes - varying for depth effect
  const sizes = useMemo(() => {
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sizes[i] = Math.random() * 0.08 + 0.02;
    }
    return sizes;
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !velocitiesRef.current) return;
    
    const geometry = pointsRef.current.geometry;
    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
    const posArray = positionAttr.array as Float32Array;
    const velocities = velocitiesRef.current;
    
    // Smooth opacity transition
    const targetOpacity = active ? 1 : 0;
    opacityRef.current += (targetOpacity - opacityRef.current) * delta * 2;
    
    const material = pointsRef.current.material as THREE.PointsMaterial;
    material.opacity = opacityRef.current;
    
    // Only animate if visible
    if (opacityRef.current < 0.01) return;
    
    const time = Date.now() * 0.001;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Add wind turbulence using sine waves
      const windX = Math.sin(time * 0.5 + i * 0.1) * 0.02;
      const windZ = Math.cos(time * 0.3 + i * 0.15) * 0.02;
      
      // Update positions with physics
      posArray[i3] += (velocities[i3] + windX) * delta;
      posArray[i3 + 1] += velocities[i3 + 1] * delta;
      posArray[i3 + 2] += (velocities[i3 + 2] + windZ) * delta;
      
      // Add slight rotation/swirl effect
      const swirl = Math.sin(time + i) * 0.005;
      posArray[i3] += swirl;
      
      // Reset snowflake when it falls below ground
      if (posArray[i3 + 1] < -5) {
        posArray[i3] = (Math.random() - 0.5) * 30;
        posArray[i3 + 1] = Math.random() * 5 + 15; // Reset to top
        posArray[i3 + 2] = (Math.random() - 0.5) * 30;
      }
      
      // Wrap horizontally to keep snowflakes in view
      if (posArray[i3] > 15) posArray[i3] = -15;
      if (posArray[i3] < -15) posArray[i3] = 15;
      if (posArray[i3 + 2] > 15) posArray[i3 + 2] = -15;
      if (posArray[i3 + 2] < -15) posArray[i3 + 2] = 15;
    }
    
    positionAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#ffffff"
        transparent
        opacity={0}
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

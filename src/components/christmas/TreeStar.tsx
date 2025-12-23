import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeState } from '@/types/christmas';

interface TreeStarProps {
  state: TreeState;
  isFocused?: boolean;
}

// Create a refined 5-pointed star shape
function createStarShape(outerRadius: number, innerRadius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const points = 5;
  
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return shape;
}

export function TreeStar({ state, isFocused = false }: TreeStarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const glowIntensityRef = useRef(0);

  // Create thin extruded star geometry
  const starGeometry = useMemo(() => {
    const shape = createStarShape(0.3, 0.12);
    const extrudeSettings = {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 1,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  // Larger glow star geometry
  const glowGeometry = useMemo(() => {
    const shape = createStarShape(0.5, 0.2);
    const extrudeSettings = {
      depth: 0.01,
      bevelEnabled: false,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    
    timeRef.current += delta;
    
    // Gentle rotation
    if (starRef.current) {
      starRef.current.rotation.z += delta * 0.2;
    }
    if (glowRef.current) {
      glowRef.current.rotation.z += delta * 0.15;
    }

    // Position based on state
    const targetY = state === 'tree' ? 4.4 : 10;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * 0.05;
    
    // Fade material
    if (starRef.current) {
      const mat = starRef.current.material as THREE.MeshBasicMaterial;
      const targetOpacity = state === 'tree' ? 1 : 0;
      mat.opacity += (targetOpacity - mat.opacity) * 0.05;
    }

    // Animate glow intensity
    const targetGlow = isFocused ? 1 : 0;
    glowIntensityRef.current += (targetGlow - glowIntensityRef.current) * delta * 3;
    
    if (glowRef.current) {
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;
      // Pulsing glow effect when focused
      const pulse = isFocused ? Math.sin(timeRef.current * 3) * 0.3 + 0.7 : 0;
      glowMat.opacity = glowIntensityRef.current * pulse;
      
      // Scale the glow when focused
      const scale = 1 + glowIntensityRef.current * (Math.sin(timeRef.current * 2) * 0.2 + 0.5);
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef} position={[0, 4.4, 0]}>
      {/* Glow layer - behind the star */}
      <mesh 
        ref={glowRef} 
        geometry={glowGeometry}
        rotation={[Math.PI / 4, 0.3, -0.1]}
        position={[0, 0, -0.05]}
      >
        <meshBasicMaterial
          color="#ffee88"
          transparent
          opacity={0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      
      {/* Main star */}
      <mesh 
        ref={starRef} 
        geometry={starGeometry}
        rotation={[Math.PI / 4, 0.3, 0]}
        position={[0, 0, 0]}
      >
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>
      
      {/* Point light for glow effect when focused */}
      <pointLight 
        color="#ffd700" 
        intensity={isFocused ? 3 : 0} 
        distance={5}
        decay={2}
      />
    </group>
  );
}
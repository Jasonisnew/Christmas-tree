import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeState } from '@/types/christmas';

// Permanent photo database from /public/picture folder
const PERMANENT_PHOTOS: string[] = [
  '/picture/12c4d7e60b6d8e78c5890f63c93c9d20.JPG',
  '/picture/1a37b000db75c8b0849b5ee3770c621e.JPG',
  '/picture/36fef6375fc7b236b205832d2ba799aa.JPG',
  '/picture/42c014aa95b7f848ecb0788c863f5282.JPG',
  '/picture/IMG_0133.JPG',
  '/picture/IMG_0129.JPG',
  '/picture/3b5a847c5437cdc522ad86ce8a1fb9d0.JPG',
  '/picture/14ac68aa2d4b1cb51d01bc3cba30d03a.JPG',
  '/picture/1edef4a7bef884c903a53d412649130f.JPG',
  '/picture/IMG_9295.JPG',
];

const getDefaultPhotos = (): string[] => {
  return PERMANENT_PHOTOS;
};

interface PhotoCardsProps {
  state: TreeState;
  photos?: string[];
  focusedIndex: number | null;
}

function generateTreePhotoPosition(index: number, total: number): [number, number, number] {
  const height = 7;
  const maxRadius = 2.8;
  const t = (index + 0.5) / total;
  const y = t * height - height / 2 + 0.5;
  const radius = maxRadius * (1 - t * 0.85);
  const angle = t * Math.PI * 10 + index * Math.PI * 0.5;
  
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

function generateGalaxyPhotoPosition(): [number, number, number] {
  const radius = 4 + Math.random() * 6;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta) * 0.5,
    radius * Math.cos(phi),
  ];
}

// Spring physics constants
const SPRING_STIFFNESS = 25;
const SPRING_DAMPING = 8;
const SCALE_STIFFNESS = 30;
const SCALE_DAMPING = 10;

// Card dimensions - portrait-friendly for photos of people
const cardWidth = 0.9;
const cardHeight = 1.2;
const photoWidth = 0.75;
const photoHeight = 0.95; // Taller photo area for portrait photos
const borderRadius = 0.03;
const photoOffsetY = 0.05;

// Pre-create shared geometries
const cardGeometry = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-cardWidth/2 + borderRadius, -cardHeight/2);
  shape.lineTo(cardWidth/2 - borderRadius, -cardHeight/2);
  shape.quadraticCurveTo(cardWidth/2, -cardHeight/2, cardWidth/2, -cardHeight/2 + borderRadius);
  shape.lineTo(cardWidth/2, cardHeight/2 - borderRadius);
  shape.quadraticCurveTo(cardWidth/2, cardHeight/2, cardWidth/2 - borderRadius, cardHeight/2);
  shape.lineTo(-cardWidth/2 + borderRadius, cardHeight/2);
  shape.quadraticCurveTo(-cardWidth/2, cardHeight/2, -cardWidth/2, cardHeight/2 - borderRadius);
  shape.lineTo(-cardWidth/2, -cardHeight/2 + borderRadius);
  shape.quadraticCurveTo(-cardWidth/2, -cardHeight/2, -cardWidth/2 + borderRadius, -cardHeight/2);
  return new THREE.ShapeGeometry(shape);
})();

const photoGeometry = new THREE.PlaneGeometry(photoWidth, photoHeight);
const cardMaterial = new THREE.MeshBasicMaterial({
  color: '#e5e0d5',
  side: THREE.DoubleSide,
  toneMapped: true,
  opacity: 0.95,
  transparent: true,
});

interface CardData {
  treePosition: [number, number, number];
  galaxyPosition: [number, number, number];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  scaleVelocity: number;
  texture: THREE.Texture | null;
  textureUrl: string; // Track URL to detect changes
  time: number;
}

export function PhotoCards({ state, photos, focusedIndex }: PhotoCardsProps) {
  const photoUrls = photos && photos.length > 0 ? photos : getDefaultPhotos();
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Group | null)[]>([]);
  const { camera } = useThree();
  
  // Initialize card data with spring physics
  const cardDataRef = useRef<CardData[]>([]);
  
  const photoData = useMemo(() => {
    return photoUrls.slice(0, 12).map((url, i) => ({
      url,
      treePosition: generateTreePhotoPosition(i, Math.min(photoUrls.length, 12)),
      galaxyPosition: generateGalaxyPhotoPosition(),
    }));
  }, [photoUrls]);

  // Helper function to apply "cover" crop to texture (like CSS object-fit: cover)
  const applyTextureCover = (texture: THREE.Texture, imageWidth: number, imageHeight: number) => {
    const cardAspect = photoWidth / photoHeight; // Target aspect ratio
    const imageAspect = imageWidth / imageHeight; // Source image aspect ratio
    
    if (imageAspect > cardAspect) {
      // Image is wider than card - crop left/right, show full height
      const scale = cardAspect / imageAspect;
      texture.repeat.set(scale, 1);
      texture.offset.set((1 - scale) / 2, 0); // Center horizontally
    } else {
      // Image is taller than card - crop top/bottom, show full width
      const scale = imageAspect / cardAspect;
      texture.repeat.set(1, scale);
      texture.offset.set(0, (1 - scale) / 2); // Center vertically (keeps people in middle)
    }
    
    texture.needsUpdate = true;
  };

  // Initialize card data and load textures
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    
    cardDataRef.current = photoData.map((photo, i) => {
      const existing = cardDataRef.current[i];
      // Check if URL changed - need to reload texture
      const urlChanged = existing?.textureUrl !== photo.url;
      
      const data: CardData = {
        treePosition: photo.treePosition,
        galaxyPosition: photo.galaxyPosition,
        position: existing?.position || new THREE.Vector3(...photo.treePosition),
        velocity: existing?.velocity || new THREE.Vector3(0, 0, 0),
        scale: existing?.scale || 0.4,
        scaleVelocity: existing?.scaleVelocity || 0,
        texture: urlChanged ? null : (existing?.texture || null), // Reset if URL changed
        textureUrl: photo.url,
        time: existing?.time || Math.random() * Math.PI * 2,
      };
      
      // Load texture if not loaded or URL changed
      if (!data.texture) {
        loader.load(
          photo.url,
          (tex) => {
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
            
            // Apply "cover" crop to maintain aspect ratio without squashing
            if (tex.image) {
              applyTextureCover(tex, tex.image.width, tex.image.height);
            }
            
            if (cardDataRef.current[i]) {
              cardDataRef.current[i].texture = tex;
              cardDataRef.current[i].textureUrl = photo.url;
            }
          },
          undefined,
          () => {
            // Fallback placeholder on error
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = `hsl(${(i * 30) % 360}, 60%, 50%)`;
              ctx.fillRect(0, 0, 200, 200);
              ctx.font = '64px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('🎄', 100, 100);
            }
            const placeholderTex = new THREE.CanvasTexture(canvas);
            placeholderTex.colorSpace = THREE.SRGBColorSpace;
            if (cardDataRef.current[i]) {
              cardDataRef.current[i].texture = placeholderTex;
            }
          }
        );
      }
      
      return data;
    });
  }, [photoData]);

  // Single useFrame for ALL cards - major performance improvement
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.033);
    const cards = cardDataRef.current;
    
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const meshGroup = meshRefs.current[i];
      if (!meshGroup || !card) continue;
      
      card.time += dt;
      const isFocused = focusedIndex === i;
      
      // Calculate target position
      const targetPos = isFocused 
        ? new THREE.Vector3(0, 0, 0.8)
        : state === 'tree' 
          ? new THREE.Vector3(...card.treePosition)
          : new THREE.Vector3(...card.galaxyPosition);
      
      const targetScale = isFocused ? 5 : 0.4;
      
      // Spring physics for position
      const displacement = card.position.clone().sub(targetPos);
      const springForce = displacement.multiplyScalar(-SPRING_STIFFNESS);
      const dampingForce = card.velocity.clone().multiplyScalar(-SPRING_DAMPING);
      const acceleration = springForce.add(dampingForce);
      
      card.velocity.add(acceleration.multiplyScalar(dt));
      card.position.add(card.velocity.clone().multiplyScalar(dt));
      
      // Spring physics for scale
      const scaleDisplacement = card.scale - targetScale;
      const scaleSpringForce = -SCALE_STIFFNESS * scaleDisplacement;
      const scaleDampingForce = -SCALE_DAMPING * card.scaleVelocity;
      card.scaleVelocity += (scaleSpringForce + scaleDampingForce) * dt;
      card.scale += card.scaleVelocity * dt;
      
      // Apply to mesh
      meshGroup.position.copy(card.position);
      if (!isFocused) {
        meshGroup.position.y += Math.sin(card.time * 0.5) * 0.005;
      }
      meshGroup.scale.set(card.scale, card.scale, 1);
      meshGroup.lookAt(camera.position);
    }
  });

  // Force re-render when textures load
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const allLoaded = cardDataRef.current.every(c => c.texture);
      if (allLoaded) {
        clearInterval(interval);
      }
      forceUpdate(n => n + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <group ref={groupRef}>
      {photoData.map((photo, i) => {
        const texture = cardDataRef.current[i]?.texture;
        return (
          <group 
            key={i} 
            ref={el => { meshRefs.current[i] = el; }}
            position={photo.treePosition}
            scale={[0.4, 0.4, 1]}
          >
            <mesh geometry={cardGeometry} renderOrder={1} material={cardMaterial} />
            {texture && (
              <mesh geometry={photoGeometry} position={[0, photoOffsetY, 0.001]} renderOrder={2}>
                <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={true} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
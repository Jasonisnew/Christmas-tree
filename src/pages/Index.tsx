import { useState, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { GestureIndicator } from '@/components/christmas/GestureIndicator';
import { AudioControl } from '@/components/christmas/AudioControl';
import { PhotoUpload } from '@/components/christmas/PhotoUpload';
import { InstructionsOverlay } from '@/components/christmas/InstructionsOverlay';
import { CameraDebug } from '@/components/christmas/CameraDebug';
import { LoadingScreen } from '@/components/christmas/LoadingScreen';
import { CustomTextOverlay } from '@/components/christmas/CustomTextOverlay';
import { useHandGesture } from '@/hooks/useHandGesture';
import { useMouseFallback } from '@/hooks/useMouseFallback';
import { useChristmasAudio } from '@/hooks/useChristmasAudio';
import { TreeState, GestureType } from '@/types/christmas';

// Permanent photo database
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

// Lazy load heavy 3D scene
const ChristmasScene = lazy(() => import('@/components/christmas/Scene').then(m => ({ default: m.ChristmasScene })));

const Index = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [treeState, setTreeState] = useState<TreeState>('tree');
  const [photos, setPhotos] = useState<string[]>(PERMANENT_PHOTOS);
  const [focusedPhotoIndex, setFocusedPhotoIndex] = useState<number | null>(null);
  const [orbitRotation, setOrbitRotation] = useState({ x: 0, y: 0 });
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied' | 'requesting'>('prompt');
  const [showInstructions, setShowInstructions] = useState(true);
  const [customText, setCustomText] = useState('Merry Christmas Mile');
  const [isStarFocused, setIsStarFocused] = useState(false);
  
  // Use refs for values accessed in callbacks to prevent re-renders
  const treeStateRef = useRef(treeState);
  const photosRef = useRef(photos);
  treeStateRef.current = treeState;
  photosRef.current = photos;

  // Simulate loading progress - slower interval
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 20;
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Mark as loaded when scene is ready
  const handleSceneReady = useCallback(() => {
    setLoadingProgress(100);
  }, []);

  // Audio hook
  const audio = useChristmasAudio();

  // Gesture handling - use refs to avoid callback recreation
  const handleGestureChange = useCallback((gesture: GestureType) => {
    const currentTreeState = treeStateRef.current;
    const currentPhotos = photosRef.current;
    
    switch (gesture) {
      case 'fist':
        setTreeState('tree');
        setFocusedPhotoIndex(null);
        break;
      case 'open':
        setTreeState('galaxy');
        setFocusedPhotoIndex(null);
        break;
      case 'pinch':
        if (currentTreeState === 'galaxy') {
          const photoCount = currentPhotos.length > 0 ? currentPhotos.length : 12;
          const randomIndex = Math.floor(Math.random() * Math.min(photoCount, 12));
          setFocusedPhotoIndex(randomIndex);
          setTreeState('focus');
        } else if (currentTreeState === 'focus') {
          setFocusedPhotoIndex(null);
          setTreeState('galaxy');
        }
        break;
    }
  }, []); // Empty deps - uses refs

  // Request camera permission - actually request it now
  const handleRequestCamera = useCallback(async () => {
    console.log('[Index] Requesting camera permission...');
    setCameraPermission('requesting');
    try {
      // Actually request camera permission from the browser
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      console.log('[Index] Camera permission granted!');
      // Keep the stream alive - MediaPipe will use it
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
    } catch (error) {
      console.error('[Index] Camera permission denied:', error);
      setCameraPermission('denied');
    }
  }, []);

  // Hand gesture hook
  const handGesture = useHandGesture({
    enabled: cameraPermission === 'granted',
    onGestureChange: handleGestureChange,
  });

  // Mouse fallback hook
  const mouseFallback = useMouseFallback({
    enabled: !handGesture.isTracking,
    currentState: treeState,
    onStateChange: setTreeState,
    onOrbitChange: setOrbitRotation,
  });

  // Update orbit from hand position
  useEffect(() => {
    if (handGesture.isTracking && handGesture.handPosition && treeState === 'galaxy') {
      setOrbitRotation({
        x: (handGesture.handPosition.y - 0.5) * Math.PI * 0.5,
        y: (handGesture.handPosition.x - 0.5) * Math.PI * 2,
      });
    }
  }, [handGesture.handPosition, handGesture.isTracking, treeState]);

  const handleDismissInstructions = useCallback(() => {
    setShowInstructions(false);
    // Auto-play music after dismissing instructions
    audio.play();
  }, [audio]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Loading Screen */}
      {!isLoaded && (
        <LoadingScreen 
          progress={loadingProgress} 
          onLoaded={() => setIsLoaded(true)} 
        />
      )}

      {/* 3D Scene - Lazy loaded with Suspense */}
      <Suspense fallback={null}>
        <ChristmasScene
          state={treeState}
          photos={photos}
          focusedPhotoIndex={focusedPhotoIndex}
          orbitRotation={orbitRotation}
          handPosition={handGesture.isTracking ? handGesture.handPosition : null}
          onReady={handleSceneReady}
          onStarFocusChange={setIsStarFocused}
        />
      </Suspense>

      {/* UI Overlays - only show after loaded */}
      {isLoaded && (
        <>
          <GestureIndicator
            gesture={handGesture.gesture}
            isTracking={handGesture.isTracking}
            usingMouse={!handGesture.isTracking}
            cameraPermission={cameraPermission}
            mediapipeStatus={handGesture.status}
            onRequestCamera={handleRequestCamera}
          />

          <AudioControl
            isPlaying={audio.isPlaying}
            isMuted={audio.isMuted}
            onToggle={audio.toggle}
            onMuteToggle={audio.toggleMute}
          />

          <PhotoUpload
            photos={photos}
            onPhotosChange={setPhotos}
          />

          {/* Camera Debug Preview */}
          <CameraDebug enabled={cameraPermission === 'granted'} />

          {/* Instructions Overlay */}
          {showInstructions && (
            <InstructionsOverlay onDismiss={handleDismissInstructions} />
          )}


          {/* Custom text overlay and edit button */}
          <CustomTextOverlay
            isVisible={isStarFocused}
            text={customText}
            onTextChange={setCustomText}
          />
        </>
      )}
    </div>
  );
};

export default Index;

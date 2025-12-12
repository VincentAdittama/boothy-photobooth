import { create } from 'zustand';

export const useStore = create((set) => ({
    currentPhase: 'LOGIN', // 'LOGIN' | 'STORY' | 'BOOTH' | 'STUDIO'
    userType: 'DEFAULT', // 'DEFAULT' | 'VIP'
    nickname: 'GUEST',
    capturedImage: null, // Legacy: Keeps single image for backward compat or single-shot
    capturedImages: [], // New: Array for strip mode
    isMirrored: true,
    // Indicates whether the currently stored capturedImage data is mirrored horizontally
    capturedImageIsMirrored: false,
    isFlashing: false,
    isFlashEnabled: true,
    isCameraPreloading: false, // New state for pre-warming camera
    originalCapturedImageIsMirrored: false, // Tracks the mirroring state of the original captured blob
    isCurtainOpen: true, // Controls the curtain transition mechanism
    isTransitioning: false, // Tracks when transitioning from Booth to Studio (prevents Booth unmount)

    setPhase: (phase) => set({ currentPhase: phase }),
    setUserType: (type) => set({ userType: type }),
    setNickname: (name) => set({ nickname: name }),
    setCapturedImage: (image) => set({ capturedImage: image }),
    setCapturedImages: (images) => set({ capturedImages: images }),
    setCapturedImageIsMirrored: (isMirrored) => set({ capturedImageIsMirrored: isMirrored }),
    setIsMirrored: (mirrored) => set({ isMirrored: mirrored }),
    setIsFlashing: (flashing) => set({ isFlashing: flashing }),
    setIsFlashEnabled: (enabled) => set({ isFlashEnabled: enabled }),
    setIsCameraPreloading: (preloading) => set({ isCameraPreloading: preloading }),
    setOriginalCapturedImageIsMirrored: (mirrored) => set({ originalCapturedImageIsMirrored: mirrored }),
    setIsCurtainOpen: (isOpen) => set({ isCurtainOpen: isOpen }),
    setIsTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
    // Historically there was an option to un-mirror exported images. We now enforce WYSIWYG
    // behavior so exported photos match the preview (mirrored state).
}));

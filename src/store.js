import { create } from 'zustand';

const DEVTOOLS_STORAGE_KEY = 'boothy.devtools';

const readDevToolsFromStorage = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(DEVTOOLS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeDevToolsToStorage = (devTools) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(DEVTOOLS_STORAGE_KEY, JSON.stringify(devTools));
    } catch {
        // ignore
    }
};

const initialDevTools = (() => {
    const stored = readDevToolsFromStorage();
    return {
        isOpen: false,
        uploadsEnabled: stored.uploadsEnabled !== undefined ? Boolean(stored.uploadsEnabled) : true,
        skipStoryAfterLogin: Boolean(stored.skipStoryAfterLogin),
        defaultPhaseOnLoad: typeof stored.defaultPhaseOnLoad === 'string' ? stored.defaultPhaseOnLoad : '',
    };
})();

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
    // New: array to track each captured image's original feed mirror state
    originalCapturedImageIsMirroredArray: [],
    isCurtainOpen: true, // Controls the curtain transition mechanism
    isTransitioning: false, // Tracks when transitioning from Booth to Studio (prevents Booth unmount)

    // Retake selection mode state
    isRetakeSelecting: false, // Whether user is selecting which photo to retake
    retakePhotoIndex: null, // Which photo (0, 1, 2) is being retaken

    // Live Photo feature state
    livePhotoFrames: [], // Array of frame arrays, one per captured image (48 frames each)
    selectedFrameIndices: [24, 24, 24], // Default to center frame (the snap moment) for each photo
    currentlyEditingPhotoIndex: null, // Which photo is being edited in the timeline (null = none)

    // Studio stickers state - persists across retakes within same session
    stickers: [],

    // Dev-only helpers (persisted to localStorage)
    devTools: initialDevTools,

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
    // Update per-shot original mirrored flags
    setOriginalCapturedImageIsMirroredAtIndex: (index, mirrored) => set((state) => ({
        originalCapturedImageIsMirroredArray: state.originalCapturedImageIsMirroredArray.map((v, i) =>
            i === index ? mirrored : v
        )
    })),
    appendOriginalCapturedImageIsMirrored: (mirrored) => set((state) => ({
        originalCapturedImageIsMirroredArray: [...(state.originalCapturedImageIsMirroredArray || []), mirrored]
    })),
    resetOriginalCapturedImageIsMirroredArray: () => set({ originalCapturedImageIsMirroredArray: [] }),
    setIsCurtainOpen: (isOpen) => set({ isCurtainOpen: isOpen }),
    setIsTransitioning: (transitioning) => set({ isTransitioning: transitioning }),

    // Retake selection actions
    setIsRetakeSelecting: (selecting) => set({ isRetakeSelecting: selecting }),
    setRetakePhotoIndex: (index) => set({ retakePhotoIndex: index }),
    clearRetakeState: () => set({ isRetakeSelecting: false, retakePhotoIndex: null }),

    // Live Photo feature actions
    setLivePhotoFrames: (frames) => set({ livePhotoFrames: frames }),
    setSelectedFrameIndex: (photoIndex, frameIndex) => set((state) => ({
        selectedFrameIndices: state.selectedFrameIndices.map((f, i) =>
            i === photoIndex ? frameIndex : f
        )
    })),
    setCurrentlyEditingPhotoIndex: (index) => set({ currentlyEditingPhotoIndex: index }),
    // Studio stickers actions
    setStickers: (stickers) => set({ stickers }),

    setDevTools: (patch) => set((state) => {
        const next = { ...(state.devTools || initialDevTools), ...(patch || {}) };
        writeDevToolsToStorage({
            uploadsEnabled: next.uploadsEnabled,
            skipStoryAfterLogin: next.skipStoryAfterLogin,
            defaultPhaseOnLoad: next.defaultPhaseOnLoad,
        });
        return { devTools: next };
    }),
    toggleDevToolsOpen: () => set((state) => ({ devTools: { ...(state.devTools || initialDevTools), isOpen: !(state.devTools && state.devTools.isOpen) } })),

    resetSession: () => set((state) => ({
        currentPhase: 'LOGIN',
        userType: 'DEFAULT',
        nickname: 'GUEST',
        capturedImage: null,
        capturedImages: [],
        capturedImageIsMirrored: false,
        isFlashing: false,
        isCameraPreloading: false,
        originalCapturedImageIsMirrored: false,
        originalCapturedImageIsMirroredArray: [],
        isCurtainOpen: true,
        isTransitioning: false,
        isRetakeSelecting: false,
        retakePhotoIndex: null,
        livePhotoFrames: [],
        selectedFrameIndices: [24, 24, 24],
        currentlyEditingPhotoIndex: null,
        stickers: [],
        // preserve devTools
        devTools: state.devTools || initialDevTools,
    })),
    // Update a specific captured image (used when confirming frame selection)
    updateCapturedImage: (photoIndex, newImageSrc) => set((state) => ({
        capturedImages: state.capturedImages.map((img, i) =>
            i === photoIndex ? newImageSrc : img
        )
    })),
    // Reset Live Photo state for new capture
    resetLivePhotoState: () => set({
        livePhotoFrames: [],
        selectedFrameIndices: [24, 24, 24],
        currentlyEditingPhotoIndex: null
    }),

    // Historically there was an option to un-mirror exported images. We now enforce WYSIWYG
    // behavior so exported photos match the preview (mirrored state).
}));

import { create } from 'zustand';

export const useStore = create((set) => ({
    currentPhase: 'LOGIN', // 'LOGIN' | 'STORY' | 'BOOTH' | 'STUDIO'
    userType: 'DEFAULT', // 'DEFAULT' | 'VIP'
    nickname: 'GUEST',
    capturedImage: null,
    isMirrored: true,
    // Indicates whether the currently stored capturedImage data is mirrored horizontally
    capturedImageIsMirrored: false,

    setPhase: (phase) => set({ currentPhase: phase }),
    setUserType: (type) => set({ userType: type }),
    setNickname: (name) => set({ nickname: name }),
    setCapturedImage: (image) => set({ capturedImage: image }),
    setCapturedImageIsMirrored: (isMirrored) => set({ capturedImageIsMirrored: isMirrored }),
    setIsMirrored: (mirrored) => set({ isMirrored: mirrored }),
    // Historically there was an option to un-mirror exported images. We now enforce WYSIWYG
    // behavior so exported photos match the preview (mirrored state).
}));

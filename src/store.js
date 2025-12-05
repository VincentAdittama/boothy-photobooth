import { create } from 'zustand';

export const useStore = create((set) => ({
    currentPhase: 'LOGIN', // 'LOGIN' | 'STORY' | 'BOOTH' | 'STUDIO'
    userType: 'DEFAULT', // 'DEFAULT' | 'VIP'
    nickname: 'GUEST',
    capturedImage: null,
    isMirrored: true,

    setPhase: (phase) => set({ currentPhase: phase }),
    setUserType: (type) => set({ userType: type }),
    setNickname: (name) => set({ nickname: name }),
    setCapturedImage: (image) => set({ capturedImage: image }),
    setIsMirrored: (mirrored) => set({ isMirrored: mirrored }),
}));

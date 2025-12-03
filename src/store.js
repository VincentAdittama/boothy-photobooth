import { create } from 'zustand';

export const useStore = create((set) => ({
    currentPhase: 'LOGIN', // 'LOGIN' | 'STORY' | 'BOOTH' | 'STUDIO'
    userType: 'DEFAULT', // 'DEFAULT' | 'VIP'
    capturedImage: null,

    setPhase: (phase) => set({ currentPhase: phase }),
    setUserType: (type) => set({ userType: type }),
    setCapturedImage: (image) => set({ capturedImage: image }),
}));

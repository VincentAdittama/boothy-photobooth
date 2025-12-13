import { useRef, useCallback, useEffect } from 'react';

/**
 * useAudio - A robust audio playback hook for production environments
 * 
 * Key features:
 * 1. Preloads audio files on component mount
 * 2. Unlocks audio context on first user interaction (required by browser autoplay policies)
 * 3. Reuses Audio instances for reliability
 * 4. Uses Web Audio API fallback for better cross-browser support
 */
const useAudio = () => {
    const audioContextRef = useRef(null);
    const audioBuffersRef = useRef({});
    const isUnlockedRef = useRef(false);
    const fallbackAudioRef = useRef({});

    // Sound file paths
    const soundPaths = {
        shutter: '/sounds/shutter.wav',
        beep: '/sounds/beep.wav'
    };

    // Initialize Web Audio API context
    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
            }
        }
        return audioContextRef.current;
    }, []);

    // Preload all audio files
    const preloadAudio = useCallback(async () => {
        const ctx = getAudioContext();

        // Preload using Web Audio API (higher quality, more reliable)
        if (ctx) {
            for (const [name, path] of Object.entries(soundPaths)) {
                try {
                    const response = await fetch(path);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    audioBuffersRef.current[name] = audioBuffer;
                } catch (e) {
                    console.warn(`Failed to preload ${name} with Web Audio API:`, e);
                }
            }
        }

        // Also preload fallback HTML5 Audio elements
        for (const [name, path] of Object.entries(soundPaths)) {
            try {
                const audio = new Audio(path);
                audio.preload = 'auto';
                // Force load
                audio.load();
                fallbackAudioRef.current[name] = audio;
            } catch (e) {
                console.warn(`Failed to preload fallback ${name}:`, e);
            }
        }
    }, [getAudioContext]);

    // Unlock audio context (must be called from user interaction)
    const unlockAudio = useCallback(async () => {
        if (isUnlockedRef.current) return true;

        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch (e) {
                console.warn('Failed to resume audio context:', e);
            }
        }

        // Also play silent audio on fallback to unlock HTML5 Audio
        for (const audio of Object.values(fallbackAudioRef.current)) {
            try {
                audio.volume = 0;
                await audio.play();
                audio.pause();
                audio.volume = 1;
                audio.currentTime = 0;
            } catch (e) {
                // Expected to fail sometimes, that's okay
            }
        }

        isUnlockedRef.current = true;
        return true;
    }, [getAudioContext]);

    // Play a sound by name
    const playSound = useCallback((name) => {
        // Try Web Audio API first (more reliable for rapid sounds)
        const ctx = getAudioContext();
        const buffer = audioBuffersRef.current[name];

        if (ctx && buffer && ctx.state === 'running') {
            try {
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
                return;
            } catch (e) {
                console.warn('Web Audio playback failed, trying fallback:', e);
            }
        }

        // Fallback to HTML5 Audio
        const audio = fallbackAudioRef.current[name];
        if (audio) {
            try {
                // Clone the audio to allow overlapping playback
                const clone = audio.cloneNode();
                clone.volume = 1;
                clone.play().catch(e => console.log('Fallback audio play failed:', e));
            } catch (e) {
                console.warn('Fallback audio failed:', e);
            }
        }
    }, [getAudioContext]);

    // Preload audio on mount
    useEffect(() => {
        preloadAudio();

        // Setup unlock listeners for user interaction
        const handleInteraction = () => {
            unlockAudio();
        };

        // Listen for any user interaction to unlock audio
        window.addEventListener('click', handleInteraction, { once: false });
        window.addEventListener('touchstart', handleInteraction, { once: false });
        window.addEventListener('keydown', handleInteraction, { once: false });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);

            // Cleanup audio context
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => { });
            }
        };
    }, [preloadAudio, unlockAudio]);

    return {
        playSound,
        unlockAudio,
        isUnlocked: () => isUnlockedRef.current
    };
};

export default useAudio;

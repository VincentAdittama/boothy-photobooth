import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { uploadPhoto, uploadLivePhotoCapture, generateSessionId } from '../lib/supabase';
import { calculateStripLayout } from '../utils/stripLayout';
import useLivePhotoBuffer from '../hooks/useLivePhotoBuffer';
import useAudio from '../hooks/useAudio';

const Booth = ({ hideUI = false }) => {
    const webcamRef = useRef(null);
    const {
        setPhase, setCapturedImage, setCapturedImages, nickname, capturedImages,
        isMirrored, setIsMirrored, capturedImageIsMirrored, appendOriginalCapturedImageIsMirrored, resetOriginalCapturedImageIsMirroredArray, setCapturedImageIsMirrored, setOriginalCapturedImageIsMirrored,
        setIsFlashing, isFlashEnabled, setIsFlashEnabled, setIsCurtainOpen, setIsTransitioning,
        setLivePhotoFrames, resetLivePhotoState,
        // Retake selection state
        isRetakeSelecting, setRetakePhotoIndex, clearRetakeState, setIsRetakeSelecting,
        updateCapturedImage, livePhotoFrames, setSelectedFrameIndex
    } = useStore();

    // Live Photo buffer hook - captures frames before and after each snap
    const bufferOptions = React.useMemo(() => ({
        fps: 12,
        duration: 2,
        quality: 0.5,
        scale: 0.5,
        isMirrored: isMirrored  // Pass current mirror state to ensure consistency
    }), [isMirrored]);

    const livePhotoBuffer = useLivePhotoBuffer(webcamRef, bufferOptions);

    // Audio hook for reliable sound playback (preloads and handles browser autoplay policies)
    const { playSound: playSoundFromHook, unlockAudio } = useAudio();

    const [isCountingDown, setIsCountingDown] = useState(false);
    const [count, setCount] = useState(3);
    const [isUploading, setIsUploading] = useState(false);
    const [flyingShots, setFlyingShots] = useState([]); // {id, src, init:{l,t}, delta:{x,y}}
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
    const holeRefs = [useRef(null), useRef(null), useRef(null)];
    const mobileHoleRefs = [useRef(null), useRef(null), useRef(null)];
    const stripRef = useRef(null);
    const webcamContainerRef = useRef(null);
    const [isStripAnimating, setIsStripAnimating] = useState(false);
    const [stripAnimPath, setStripAnimPath] = useState({
        inspect: { x: 0, y: 0 },
        target: { x: 0, y: 0 },
        targetScale: 1.2
    });
    const [landedShots, setLandedShots] = useState([false, false, false]);

    // Track screen size for mobile/desktop switching
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Start live photo buffering when booth is visible
    useEffect(() => {
        if (!hideUI) {
            livePhotoBuffer.startBuffering();
        }
        return () => {
            livePhotoBuffer.stopBuffering();
        };
    }, [hideUI, livePhotoBuffer]);

    // Helper to sleep
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Use the hook-based playSound
    const playSound = (type) => {
        playSoundFromHook(type);
    };

    // NOTE: capture data is stored unmirrored. Mirroring should be handled at display time.
    const unmirrorDataURL = (dataURL) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = dataURL;
        });
    };


    const handleStartStrip = async () => {
        // Unlock audio on user interaction (required for browser autoplay policies)
        await unlockAudio();

        // reset landed state and live photo state for new capture sequence
        setLandedShots([false, false, false]);
        resetLivePhotoState();
        resetOriginalCapturedImageIsMirroredArray();
        // Clear retake state to hide the glow effect during transition
        clearRetakeState();
        const shots = [];
        const allLiveFrames = [];
        const TOTAL_SHOTS = 3;

        // Generate unique session ID for this capture sequence
        const sessionId = generateSessionId();

        // Ensure live photo buffering is active
        if (!livePhotoBuffer.isBuffering) {
            livePhotoBuffer.startBuffering();
            // Wait for buffer warm-up equal to configured duration (plus small margin)
            const warmMs = (livePhotoBuffer.framesPerBuffer / livePhotoBuffer.fps) * 1000 + 200;
            await delay(warmMs);
        }

        // Initialize view state to match booth preference at START of capture
        setCapturedImageIsMirrored(isMirrored);

        for (let i = 0; i < TOTAL_SHOTS; i++) {
            // Countdown
            setIsCountingDown(true);
            for (let c = 3; c > 0; c--) {
                setCount(c);
                playSound('beep');
                await delay(1000);
            }
            setIsCountingDown(false);

            // Flash effect
            if (isFlashEnabled) {
                setIsFlashing(true);
                setTimeout(() => setIsFlashing(false), 250);
            }
            playSound('shutter');

            // Wait for flash to reach peak before capturing
            // Flash duration is 250ms, so capture at 200ms when it's at full brightness
            await delay(200);

            // Capture snap frame immediately, let buffer continue in background
            const liveResultPromise = livePhotoBuffer.captureWithBuffer();

            // Get snap frame right away (it's captured at the start of captureWithBuffer)
            let shot = webcamRef.current.getScreenshot();
            // If the feed was mirrored at capture time, unmirror the screenshot so stored data is canonical/unmirrored
            if (shot && isMirrored) {
                try {
                    shot = await unmirrorDataURL(shot);
                } catch (e) {
                    console.warn('Failed to unmirror shot', e);
                }
            }
            if (shot) {
                shots.push(shot);
                // Track original feed mirror state for this shot so we can display it consistently later
                appendOriginalCapturedImageIsMirrored(Boolean(isMirrored));

                // Fire-and-forget upload to Supabase for history tracking
                uploadLivePhotoCapture({
                    nickname,
                    photoData: shot,
                    sessionId,
                    photoIndex: shots.length - 1,
                    captureType: 'snap'
                });

                // trigger fly animation for this shot to its hole IMMEDIATELY
                // Don't wait for live photo buffer to complete
                await animateShotToHole(shots.length - 1, shot);

                // after animation completes, update preview holes so captured image appears in cuthole
                setCapturedImages([...shots]);
                if (shots.length === 1) setCapturedImage(shots[0]);
                setLandedShots(prev => {
                    const next = [...prev];
                    next[shots.length - 1] = true;
                    return next;
                });
            }

            // Now wait for live photo buffer to complete and gather frames
            const liveResult = await liveResultPromise;
            const frames = liveResult.frames; // All 48 frames
            allLiveFrames.push(frames);

            // Brief pause/feedback between shots if not last
            // Note: captureWithBuffer already takes ~2s for after-frames
            if (i < TOTAL_SHOTS - 1) {
                await delay(500); // Reduced delay since capture takes longer now
            }
        }

        // Store all live photo frames
        setLivePhotoFrames(allLiveFrames);

        // Done capturing
        if (shots.length > 0) {
            setCapturedImages(shots);
            setCapturedImage(shots[0]); // Set first as preview or primary

            // Meta info
            // setCapturedImageIsMirrored(isMirrored); // Already set at start
            setOriginalCapturedImageIsMirrored(Boolean(isMirrored)); // Track feed mirroring state

            setIsUploading(true);

            try {
                // Upload all sequentially
                for (const [index, src] of shots.entries()) {
                    const res = await fetch(src);
                    const blob = await res.blob();
                    await uploadPhoto(`${nickname}-strip-${index}`, blob);
                }
            } catch (e) {
                console.error("Upload failed", e);
            } finally {
                setIsUploading(false);
                // play final strip animation
                // User Request: Seamless transition

                // 0. Mark that we're transitioning (this pre-mounts Studio behind the scenes)
                setIsTransitioning(true);

                // 1. Give Studio time to mount (hidden)
                await delay(100);

                // 2. Start the photostrip animation (3.5s total)
                animateStripToBooth();

                // 3. Start curtain close transition immediately (user sees strip + curtain closing)
                setIsCurtainOpen(false);

                // 4. Wait for curtain to substantially close (1s)
                // This hides the screen.
                await delay(1000);

                // 5. Switch to Studio phase behind the curtain
                // Studio has been mounted for ~1.1s now (invisible), so it should be ready.
                // Switching phase makes it "visible" in App (opacity 1) but curtain is covering it.
                setPhase('STUDIO');

                // 6. Wait for remaining transition time
                // Total curtain time target: ~3.3s from close to open
                // We waited 1s already. Wait 2.3s more.
                await delay(2300);

                // 7. Open curtain to reveal Studio
                setIsCurtainOpen(true);

                // Clear transition flag after curtain opens
                await delay(100);
                setIsTransitioning(false);
            }
        }
    };

    // Single photo capture for retake mode - captures one photo and replaces at specified index
    const handleSinglePhotoCapture = async (targetIndex) => {
        if (targetIndex === null || targetIndex === undefined || targetIndex < 0 || targetIndex >= 3) return;

        // Unlock audio on user interaction (required for browser autoplay policies)
        await unlockAudio();

        // Generate unique session ID for retake
        const retakeSessionId = generateSessionId();

        // Ensure live photo buffering is active
        if (!livePhotoBuffer.isBuffering) {
            livePhotoBuffer.startBuffering();
            const warmMs = (livePhotoBuffer.framesPerBuffer / livePhotoBuffer.fps) * 1000 + 200;
            await delay(warmMs);
        }

        // Add delay before countdown (like regular mode)
        await delay(500);

        // Countdown
        setIsCountingDown(true);
        for (let c = 3; c > 0; c--) {
            setCount(c);
            playSound('beep');
            await delay(1000);
        }
        setIsCountingDown(false);

        // Flash effect
        if (isFlashEnabled) {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 250);
        }
        playSound('shutter');

        await delay(200);

        // Capture snap frame
        const liveResultPromise = livePhotoBuffer.captureWithBuffer();
        let shot = webcamRef.current.getScreenshot();

        if (shot && isMirrored) {
            try {
                shot = await unmirrorDataURL(shot);
            } catch (e) {
                console.warn('Failed to unmirror shot', e);
            }
        }

        if (shot) {
            // Fire-and-forget upload to Supabase for history tracking
            uploadLivePhotoCapture({
                nickname,
                photoData: shot,
                sessionId: retakeSessionId,
                photoIndex: targetIndex,
                captureType: 'retake'
            });

            // Trigger fly animation to the target cuthole
            // For single retake captures, originate from the actual video canvas for pixel-accurate feel
            await animateShotToHole(targetIndex, shot, { useVideo: true });

            // Update the specific captured image after animation completes
            updateCapturedImage(targetIndex, shot);

            // Update the live photo frames for this index
            const liveResult = await liveResultPromise;
            const newFrames = [...livePhotoFrames];
            newFrames[targetIndex] = liveResult.frames;
            setLivePhotoFrames(newFrames);

            // Reset the selected frame index to default (snap moment = 24)
            // This prevents the old frame selection from persisting with the new photo
            setSelectedFrameIndex(targetIndex, 24);

            // Upload the replaced photo
            setIsUploading(true);
            try {
                const res = await fetch(shot);
                const blob = await res.blob();
                await uploadPhoto(`${nickname}-strip-${targetIndex}-retake`, blob);
            } catch (e) {
                console.error("Upload failed", e);
            } finally {
                setIsUploading(false);

                // Return to retake selection mode (user can select another photo or go back)
                setRetakePhotoIndex(null);
                setIsRetakeSelecting(true);
            }
        }
    };

    // Handle photo selection in retake mode
    const handleRetakePhotoSelect = (index) => {
        setRetakePhotoIndex(index);
        setIsRetakeSelecting(false);
        // Start single photo capture immediately, passing index directly
        handleSinglePhotoCapture(index);
    };

    // Handle back button in retake selection
    const handleBackToStudio = () => {
        clearRetakeState();
        setPhase('STUDIO');
    };


    const handleStartCapture = handleStartStrip; // Alias for now

    // Utility: get center coords of webcam for initial flying image position
    // preferVideo: when true, use the video element's bounding rect (pixel-accurate canvas);
    // otherwise use the visible container center which matches what the user sees (object-cover cropped).
    const getWebcamCenter = (preferVideo = false) => {
        const videoEl = webcamRef.current && webcamRef.current.video ? webcamRef.current.video : null;

        if (preferVideo && videoEl && videoEl.getBoundingClientRect) {
            const r = videoEl.getBoundingClientRect();
            return { left: r.left + r.width / 2, top: r.top + r.height / 2 };
        }

        // Prefer the container's visible center for accurate visual origin
        if (webcamContainerRef.current && webcamContainerRef.current.getBoundingClientRect) {
            const r = webcamContainerRef.current.getBoundingClientRect();
            return { left: r.left + r.width / 2, top: r.top + r.height / 2 };
        }

        // Fallback to video element if available
        if (videoEl && videoEl.getBoundingClientRect) {
            const r = videoEl.getBoundingClientRect();
            return { left: r.left + r.width / 2, top: r.top + r.height / 2 };
        }

        // Last resort: viewport center
        return { left: window.innerWidth / 2, top: window.innerHeight / 2 };
    };

    // Animate single shot from center to the hole index. Returns when animation completes.
    const animateShotToHole = async (index, src, opts = {}) => {
        // compute initial center and target hole center
        const c = getWebcamCenter(Boolean(opts.useVideo));
        // Use mobile or desktop refs based on current screen size
        const activeHoleRefs = isMobile ? mobileHoleRefs : holeRefs;
        const holeEl = activeHoleRefs[index]?.current;
        let target = isMobile
            ? { left: window.innerWidth / 2, top: window.innerHeight - 150 }
            : { left: 80, top: window.innerHeight / 2 };
        if (holeEl) {
            const hr = holeEl.getBoundingClientRect();
            target = { left: hr.left + hr.width / 2, top: hr.top + hr.height / 2 };
        }

        const initLeft = c.left;
        const initTop = c.top;
        const deltaX = target.left - initLeft;
        const deltaY = target.top - initTop;

        const id = Date.now() + Math.random();
        // Capture the feed mirroring state at the exact moment of capture to avoid race conditions
        const flying = { id, src, initLeft, initTop, deltaX, deltaY, originalMirrored: Boolean(isMirrored) };

        return new Promise((resolve) => {
            // add flying item
            setFlyingShots(s => [...s, flying]);

            // wait for animation duration + small buffer
            const D = 900;
            setTimeout(() => {
                // remove flying item after landed
                setFlyingShots(s => s.filter(f => f.id !== id));
                resolve();
            }, D + 50);
        });
    };

    // Animate strip through inspect (center screen) then to Studio canvas target
    const animateStripToBooth = async () => {
        const stripEl = stripRef.current;

        // Use the exact same layout logic as Studio to determine target scale/pos
        const isDesktop = window.innerWidth >= 768;
        const containerW = isDesktop ? window.innerWidth - 320 : window.innerWidth;
        const containerH = window.innerHeight;

        const layout = calculateStripLayout(containerW, containerH, 3);

        // Target X needs to be the center of the Studio's canvas area
        // If desktop, sidebar is 320px on the right. 
        // So canvas center is (windowWidth - 320) / 2
        // IF we want it to land exactly where it renders in Studio.
        let targetX = containerW / 2;
        let targetY = containerH / 2; // Vertically centered

        const screenCenter = { left: window.innerWidth / 2, top: window.innerHeight / 2 }; // inspect spot
        const canvasCenter = { left: targetX, top: targetY }; // final spot

        if (stripEl && stripEl.getBoundingClientRect) {
            const sr = stripEl.getBoundingClientRect();
            const stripCenter = { left: sr.left + sr.width / 2, top: sr.top + sr.height / 2 };

            const inspectDelta = {
                x: screenCenter.left - stripCenter.left,
                y: screenCenter.top - stripCenter.top
            };

            const targetDelta = {
                x: canvasCenter.left - stripCenter.left,
                y: canvasCenter.top - stripCenter.top
            };

            setStripAnimPath({
                inspect: inspectDelta,
                target: targetDelta,
                targetScale: layout.scale
            });
        }

        setIsStripAnimating(true);
        // Animation duration is 3.5s (500ms intro + 2000ms inspect + 1000ms fly). Wait for it to finish.
        await new Promise(r => setTimeout(r, 3500));
    };

    return (
        <div className="h-full w-full bg-black relative overflow-hidden flex flex-col items-center justify-center">
            {/* Flying Photos Animation - photos fly from webcam to preview strip holes */}
            <AnimatePresence>
                {flyingShots.map(shot => (
                    <div
                        key={shot.id}
                        className="pointer-events-none"
                        style={{
                            position: 'fixed',
                            left: shot.initLeft,
                            top: shot.initTop,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 9999
                        }}
                    >
                        <Motion.div
                            initial={{
                                x: 0,
                                y: 0,
                                scale: 0.15,
                                opacity: 0,
                                rotate: -10
                            }}
                            animate={{
                                x: [0, shot.deltaX * 0.3, shot.deltaX],
                                y: [0, shot.deltaY * 0.2 - 80, shot.deltaY],
                                scale: [0.15, 0.85, 0.7],
                                opacity: [0, 1, 1],
                                rotate: [-10, 8, 0]
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.6,
                                transition: { duration: 0.15 }
                            }}
                            transition={{
                                duration: 0.9,
                                ease: [0.34, 1.56, 0.64, 1], // Spring-like bounce
                                times: [0, 0.5, 1]
                            }}
                        >
                            {/* Photo with glow and shadow effect */}
                            <Motion.div
                                initial={{ boxShadow: '0 6px 30px rgba(0,0,0,0.35)' }}
                                animate={{
                                    boxShadow: [
                                        '0 6px 30px rgba(0,0,0,0.35)',
                                        '0 20px 50px rgba(0,0,0,0.5)',
                                        '0 8px 25px rgba(0,0,0,0.4)'
                                    ]
                                }}
                                transition={{ duration: 0.9, times: [0, 0.5, 1] }}
                                className="w-28 h-28 lg:w-32 lg:h-32 rounded-sm overflow-hidden bg-white"
                            >
                                <img
                                    src={shot.src}
                                    alt="flying-photo"
                                    className="w-full h-full object-cover"
                                    style={{ transform: shot.originalMirrored ? 'scaleX(-1)' : 'none' }}
                                />
                            </Motion.div>
                        </Motion.div>
                    </div>
                ))}
            </AnimatePresence>

            {/* Retake Selection Mode - Shows back button and instruction overlay */}
            <AnimatePresence>
                {isRetakeSelecting && capturedImages && capturedImages.length > 0 && (
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[100] pointer-events-none"
                    >
                        {/* Subtle overlay to focus attention */}
                        <div className="absolute inset-0 bg-black/20" />

                        {/* Top bar */}
                        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 lg:p-6">
                            {/* Left: Instruction badge */}
                            <Motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
                                className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-cute-pink to-pink-400 text-white font-bold rounded-2xl shadow-lg"
                            >
                                <Motion.span
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="w-2.5 h-2.5 bg-white rounded-full"
                                />
                                <span className="hidden sm:inline">Tap a photo to retake</span>
                                <span className="sm:hidden">Tap to retake</span>
                            </Motion.div>

                            {/* Right: Back Button */}
                            <Motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 25 }}
                                onClick={handleBackToStudio}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 rounded-2xl text-gray-700 font-bold shadow-lg transition-all border border-gray-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                </svg>
                                <span className="hidden sm:inline">Done</span>
                            </Motion.button>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>

            {/* Left-side preview strip (desktop only) - ALWAYS VISIBLE for animation */}
            <div className="hidden lg:flex absolute left-6 top-1/2 transform -translate-y-1/2 z-200">
                {/* Animated glow ring when in retake selection mode */}
                {isRetakeSelecting && (
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{
                            opacity: [0.4, 0.8, 0.4],
                            scale: [1, 1.02, 1]
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -inset-3 bg-gradient-to-br from-cute-pink via-pink-400 to-purple-400 rounded-lg blur-md -z-10"
                    />
                )}
                <Motion.div
                    ref={stripRef}
                    initial={{ scale: 1, rotate: 0, x: 0, y: 0 }}
                    animate={isStripAnimating ? {
                        x: [0, stripAnimPath.inspect.x, stripAnimPath.inspect.x, stripAnimPath.target.x],
                        y: [0, stripAnimPath.inspect.y, stripAnimPath.inspect.y + 15, stripAnimPath.target.y],
                        scale: [1.1, 1.35, 1.4, stripAnimPath.targetScale],
                        rotate: [0, -5, 5, 0],
                        transition: {
                            duration: 3.5,
                            ease: [0.4, 0, 0.2, 1],
                            times: [0, 0.143, 0.714, 1]
                        }
                    } : {}}
                    transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 1 }}
                    className={`bg-white rounded-lg shadow-2xl border-4 relative overflow-hidden transition-colors duration-300 ${isRetakeSelecting ? 'border-cute-pink' : 'border-white'}`}
                    style={{ padding: 'var(--strip-padding)' }}
                >
                    <div className="flex flex-col items-center relative z-10" style={{ gap: 'var(--strip-padding)' }}>
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <Motion.div
                                key={idx}
                                ref={holeRefs[idx]}
                                className={`w-28 h-28 bg-gray-100 overflow-hidden flex items-center justify-center relative rounded-sm ${isRetakeSelecting ? 'cursor-pointer ring-2 ring-transparent hover:ring-cute-pink' : ''}`}
                                initial={{ scale: 1 }}
                                animate={landedShots[idx] ? { scale: [0.8, 1.05, 1] } : {}}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                                whileHover={isRetakeSelecting ? { scale: 1.06, y: -2 } : {}}
                                whileTap={isRetakeSelecting ? { scale: 0.95 } : {}}
                                onClick={isRetakeSelecting && capturedImages && capturedImages[idx] ? () => handleRetakePhotoSelect(idx) : undefined}
                            >
                                {capturedImages && capturedImages[idx] ? (
                                    <img src={capturedImages[idx]} alt={`strip-${idx}`} className="w-full h-full object-cover" style={{ transform: capturedImageIsMirrored ? 'scaleX(-1)' : 'none' }} />
                                ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">---</div>
                                )}
                                {/* Hover overlay for retake selection */}
                                {isRetakeSelecting && capturedImages && capturedImages[idx] && (
                                    <div className="absolute inset-0 bg-cute-pink/70 opacity-0 hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white mb-1">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                        </svg>
                                        <span className="text-white font-bold text-xs uppercase tracking-wide">Retake</span>
                                    </div>
                                )}
                                {/* Photo number badge - always visible in retake mode */}
                                {isRetakeSelecting && capturedImages && capturedImages[idx] && (
                                    <Motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.1 + idx * 0.05, type: 'spring', stiffness: 400 }}
                                        className="absolute top-1.5 left-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center text-gray-700 text-xs font-bold shadow-md"
                                    >
                                        {idx + 1}
                                    </Motion.div>
                                )}
                            </Motion.div>
                        ))}
                    </div>

                    {/* Shine/Glare Effect */}
                    <Motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={isStripAnimating ? {
                            x: ['-100%', '200%'],
                            opacity: [0, 1, 1, 0]
                        } : {}}
                        transition={{
                            delay: 0.8,
                            duration: 1.5,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 w-full h-full bg-linear-to-tr from-transparent via-white/60 to-transparent z-20 pointer-events-none skew-x-12"
                    />
                </Motion.div>
            </div>

            {/* Main Booth UI - hidden during transition */}
            {/* Using visibility:hidden instead of conditional render to prevent layout shifts */}
            <div className={`w-full h-full flex flex-col transition-opacity duration-300 ${hideUI ? 'opacity-0 pointer-events-none invisible' : 'opacity-100 visible'}`}>

                {/* Responsive Layout Container */}
                {/* Mobile: centered grid, Desktop: top-centered */}
                <div className="flex flex-col lg:items-center lg:justify-start h-full lg:h-full">

                    {/* Camera Feed - Single Webcam for both mobile and desktop */}
                    {/* Mobile: fixed aspect ratio container (WYSIWYG - no cropping), Desktop: large square */}
                    <div ref={webcamContainerRef} className="relative w-full aspect-square max-h-[60vh] lg:flex-none lg:max-w-[80vh] lg:max-h-[80vh] lg:rounded-3xl overflow-hidden lg:shadow-2xl lg:border-4 lg:border-white/20 flex items-center justify-center bg-black">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/png"
                            className="w-full h-full object-cover lg:object-top"
                            mirrored={isMirrored}
                            videoConstraints={{
                                facingMode: "user",
                                width: 720,
                                height: 720
                            }}
                        />

                        {/* Countdown Overlay */}
                        <AnimatePresence>
                            {isCountingDown && (
                                <Motion.div
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1.5, opacity: 1 }}
                                    exit={{ scale: 2, opacity: 0 }}
                                    key={count}
                                    className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                                >
                                    <span className="text-9xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                                        {count}
                                    </span>
                                </Motion.div>
                            )}
                        </AnimatePresence>

                        {/* Uploading Overlay */}
                        {isUploading && !isStripAnimating && (
                            <div className="absolute inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                    <p className="text-white font-bold text-xl">Developing photo strip...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile Strip Preview - below video (only on mobile) */}
                    <div className="lg:hidden shrink-0 py-3 flex justify-center bg-black">
                        <Motion.div
                            initial={{ scale: 1, rotate: 0, x: 0, y: 0 }}
                            animate={isStripAnimating ? {
                                y: [0, -100, -100, -300],
                                scale: [1.1, 1.35, 1.4, 0.8],
                                rotate: [0, -3, 3, 0],
                                opacity: [1, 1, 1, 0],
                                transition: {
                                    duration: 3.5,
                                    ease: [0.4, 0, 0.2, 1],
                                    times: [0, 0.143, 0.714, 1]
                                }
                            } : {}}
                            transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 1 }}
                            className={`bg-white rounded-lg shadow-2xl border-4 relative overflow-hidden transition-colors duration-300 ${isRetakeSelecting ? 'border-cute-pink' : 'border-white'}`}
                            style={{ padding: 'calc(var(--strip-padding) * 0.5)' }}
                        >
                            <div className="flex flex-row items-center relative z-10" style={{ gap: 'calc(var(--strip-padding) * 0.5)' }}>
                                {Array.from({ length: 3 }).map((_, idx) => (
                                    <Motion.div
                                        key={idx}
                                        ref={mobileHoleRefs[idx]}
                                        className={`w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 overflow-hidden flex items-center justify-center relative rounded-sm ${isRetakeSelecting ? 'cursor-pointer' : ''}`}
                                        initial={{ scale: 1 }}
                                        animate={landedShots[idx] ? { scale: [0.8, 1.05, 1] } : {}}
                                        transition={{ duration: 0.45, ease: 'easeOut' }}
                                        whileHover={isRetakeSelecting ? { scale: 1.08 } : {}}
                                        whileTap={isRetakeSelecting ? { scale: 0.92 } : {}}
                                        onClick={isRetakeSelecting && capturedImages && capturedImages[idx] ? () => handleRetakePhotoSelect(idx) : undefined}
                                    >
                                        {capturedImages && capturedImages[idx] ? (
                                            <img src={capturedImages[idx]} alt={`strip-${idx}`} className="w-full h-full object-cover" style={{ transform: capturedImageIsMirrored ? 'scaleX(-1)' : 'none' }} />
                                        ) : (
                                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300 text-xs">---</div>
                                        )}
                                        {/* Number badge for retake selection */}
                                        {isRetakeSelecting && capturedImages && capturedImages[idx] && (
                                            <Motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: 0.1 + idx * 0.05, type: 'spring', stiffness: 400 }}
                                                className="absolute top-1 left-1 w-4 h-4 bg-cute-pink rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow"
                                            >
                                                {idx + 1}
                                            </Motion.div>
                                        )}
                                    </Motion.div>
                                ))}
                            </div>

                            {/* Shine/Glare Effect */}
                            <Motion.div
                                initial={{ x: '-100%', opacity: 0 }}
                                animate={isStripAnimating ? {
                                    x: ['-100%', '200%'],
                                    opacity: [0, 1, 1, 0]
                                } : {}}
                                transition={{
                                    delay: 0.8,
                                    duration: 1.5,
                                    ease: "easeInOut"
                                }}
                                className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/60 to-transparent z-20 pointer-events-none skew-x-12"
                            />
                        </Motion.div>
                    </div>

                    {/* Mobile Controls - Clean symmetrical design */}
                    <div className="lg:hidden shrink-0 py-5 flex justify-center items-center bg-gradient-to-t from-black via-black/80 to-transparent">
                        <div className={`flex items-center gap-5 transition-all duration-300 ${(isCountingDown || isUploading || isStripAnimating) ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}>
                            {/* Mirror Toggle - Left */}
                            <Motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => setIsMirrored(!isMirrored)}
                                className="group"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${isMirrored ? 'bg-cyan-500/90 border-cyan-400/50 shadow-lg shadow-cyan-500/40' : 'bg-white/10 border-white/20'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-5 h-5 transition-colors duration-200 ${isMirrored ? 'text-white' : 'text-white/80'}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                    </svg>
                                </div>
                            </Motion.button>

                            {/* Shutter Button - Center Hero */}
                            <div className="relative">
                                {/* Soft glow */}
                                <div className="absolute -inset-2 rounded-full bg-pink-500/20 blur-lg" />

                                {/* Breathing ring */}
                                <Motion.div
                                    animate={{
                                        scale: [1, 1.06, 1],
                                        opacity: [0.5, 0.2, 0.5]
                                    }}
                                    transition={{
                                        duration: 2.5,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className="absolute -inset-0.5 rounded-full border-2 border-pink-400/50"
                                />

                                <Motion.button
                                    whileTap={{ scale: 0.92 }}
                                    onClick={handleStartCapture}
                                    className="relative w-16 h-16 rounded-full shadow-xl flex items-center justify-center overflow-hidden"
                                    style={{
                                        background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)',
                                        boxShadow: '0 6px 24px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.8)'
                                    }}
                                >
                                    {/* Pink inner button */}
                                    <div
                                        className="w-12 h-12 rounded-full"
                                        style={{
                                            background: 'linear-gradient(145deg, #f87171 0%, #f4978e 40%, #e11d48 100%)',
                                            boxShadow: 'inset 0 -3px 10px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)'
                                        }}
                                    />
                                    {/* Top shine */}
                                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-white/50 rounded-full blur-[2px]" />
                                </Motion.button>

                                {/* Retake All indicator */}
                                {isRetakeSelecting && (
                                    <Motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-gray-900/95 text-white text-[10px] font-bold rounded-full shadow-lg backdrop-blur-sm"
                                    >
                                        Retake All
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                                    </Motion.div>
                                )}
                            </div>

                            {/* Flash Toggle - Right */}
                            <Motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={() => setIsFlashEnabled(!isFlashEnabled)}
                                className="group"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${isFlashEnabled ? 'bg-amber-500/90 border-amber-400/50 shadow-lg shadow-amber-500/40' : 'bg-white/10 border-white/20'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill={isFlashEnabled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-5 h-5 transition-all duration-200 ${isFlashEnabled ? 'text-white' : 'text-white/80'}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                    </svg>
                                </div>
                            </Motion.button>
                        </div>
                    </div>

                    {/* Mobile Login info - bottom */}
                    <div className="lg:hidden shrink-0 py-2 bg-black text-center">
                        <span className="text-white/50 font-mono text-xs">LOGGED IN AS: {nickname}</span>
                    </div>

                    {/* Desktop Controls - Clean symmetrical design */}
                    <div className="hidden lg:flex absolute bottom-10 left-0 right-0 justify-center items-center z-10">
                        <AnimatePresence>
                            {!isCountingDown && !isUploading && !isStripAnimating && (
                                <Motion.div
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className="flex items-center gap-6"
                                >
                                    {/* Mirror Toggle - Left */}
                                    <Motion.button
                                        whileHover={{ scale: 1.1, y: -2 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setIsMirrored(!isMirrored)}
                                        className="group"
                                        title={isMirrored ? "Turn Mirroring Off" : "Turn Mirroring On"}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${isMirrored ? 'bg-cyan-500/90 border-cyan-400/50 shadow-lg shadow-cyan-500/50' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-6 h-6 transition-all duration-200 ${isMirrored ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                            </svg>
                                        </div>
                                    </Motion.button>

                                    {/* Shutter Button - Center Hero */}
                                    <div className="relative">
                                        {/* Soft glow background */}
                                        <div className="absolute -inset-3 rounded-full bg-pink-500/20 blur-xl" />

                                        {/* Subtle breathing animation ring */}
                                        <Motion.div
                                            animate={{
                                                scale: [1, 1.08, 1],
                                                opacity: [0.6, 0.3, 0.6]
                                            }}
                                            transition={{
                                                duration: 3,
                                                repeat: Infinity,
                                                ease: "easeInOut"
                                            }}
                                            className="absolute -inset-1 rounded-full border-2 border-pink-400/60"
                                        />

                                        <Motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.92 }}
                                            onClick={handleStartCapture}
                                            className="relative w-20 h-20 rounded-full shadow-2xl flex items-center justify-center overflow-hidden group"
                                            style={{
                                                background: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 50%, #e8e8e8 100%)',
                                                boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.8)'
                                            }}
                                        >
                                            {/* Pink inner button */}
                                            <div
                                                className="w-[64px] h-[64px] rounded-full flex items-center justify-center group-hover:brightness-110 transition-all duration-200"
                                                style={{
                                                    background: 'linear-gradient(145deg, #f87171 0%, #f4978e 40%, #e11d48 100%)',
                                                    boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)'
                                                }}
                                            />
                                            {/* Top shine */}
                                            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-2 bg-white/60 rounded-full blur-[2px]" />
                                        </Motion.button>

                                        {/* Retake All indicator */}
                                        {isRetakeSelecting && (
                                            <Motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 bg-gray-900/95 text-white text-xs font-bold rounded-full shadow-lg backdrop-blur-sm"
                                            >
                                                Retake All
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                                            </Motion.div>
                                        )}
                                    </div>

                                    {/* Flash Toggle - Right */}
                                    <Motion.button
                                        whileHover={{ scale: 1.1, y: -2 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setIsFlashEnabled(!isFlashEnabled)}
                                        className="group"
                                        title={isFlashEnabled ? "Turn Flash Off" : "Turn Flash On"}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${isFlashEnabled ? 'bg-amber-500/90 border-amber-400/50 shadow-lg shadow-amber-500/50' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill={isFlashEnabled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-6 h-6 transition-all duration-200 ${isFlashEnabled ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                            </svg>
                                        </div>
                                    </Motion.button>
                                </Motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Desktop Login info - bottom left */}
                    <div className="hidden lg:block absolute bottom-4 left-4 text-white/50 font-mono text-sm">
                        LOGGED IN AS: {nickname}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Booth;

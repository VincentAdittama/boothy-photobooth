import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { uploadPhoto } from '../lib/supabase';
import { calculateStripLayout } from '../utils/stripLayout';
import useLivePhotoBuffer from '../hooks/useLivePhotoBuffer';

const Booth = ({ hideUI = false }) => {
    const webcamRef = useRef(null);
    const {
        setPhase, setCapturedImage, setCapturedImages, nickname, capturedImages,
        isMirrored, setIsMirrored, setCapturedImageIsMirrored, setOriginalCapturedImageIsMirrored,
        setIsFlashing, isFlashEnabled, setIsFlashEnabled, setIsCurtainOpen, setIsTransitioning,
        setLivePhotoFrames, resetLivePhotoState
    } = useStore();

    // Live Photo buffer hook - captures frames before and after each snap
    const livePhotoBuffer = useLivePhotoBuffer(webcamRef, {
        fps: 12,
        duration: 2,
        quality: 0.5,
        scale: 0.5,
        isMirrored: isMirrored  // Pass current mirror state to ensure consistency
    });

    const [isCountingDown, setIsCountingDown] = useState(false);
    const [count, setCount] = useState(3);
    const [isUploading, setIsUploading] = useState(false);
    const [flyingShots, setFlyingShots] = useState([]); // {id, src, init:{l,t}, delta:{x,y}}
    const holeRefs = [useRef(null), useRef(null), useRef(null)];
    const stripRef = useRef(null);
    const [isStripAnimating, setIsStripAnimating] = useState(false);
    const [stripAnimPath, setStripAnimPath] = useState({
        inspect: { x: 0, y: 0 },
        target: { x: 0, y: 0 },
        targetScale: 1.2
    });
    const [landedShots, setLandedShots] = useState([false, false, false]);
    const [isLiveCapturing, setIsLiveCapturing] = useState(false);

    // Start live photo buffering when booth is visible
    useEffect(() => {
        if (!hideUI) {
            livePhotoBuffer.startBuffering();
        }
        return () => {
            livePhotoBuffer.stopBuffering();
        };
    }, [hideUI]);

    // Helper to sleep
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const playSound = (type) => {
        const audio = new Audio(type === 'shutter' ? '/sounds/shutter.wav' : '/sounds/beep.wav');
        audio.play().catch(e => console.log('Audio play failed', e));
    };

    const takeShot = async () => {
        // Flash logic
        if (isFlashEnabled) {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 250);
        }
        playSound('shutter');

        // Wait for flash peak (50ms)
        await delay(50);

        const imageSrc = webcamRef.current.getScreenshot();
        return imageSrc;
    };

    const handleStartStrip = async () => {
        // reset landed state and live photo state for new capture sequence
        setLandedShots([false, false, false]);
        resetLivePhotoState();
        const shots = [];
        const allLiveFrames = [];
        const TOTAL_SHOTS = 3;

        // Ensure live photo buffering is active
        if (!livePhotoBuffer.isBuffering) {
            livePhotoBuffer.startBuffering();
            await delay(500); // Give buffer time to warm up
        }

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
            setIsLiveCapturing(true);
            const liveResultPromise = livePhotoBuffer.captureWithBuffer();

            // Get snap frame right away (it's captured at the start of captureWithBuffer)
            const shot = webcamRef.current.getScreenshot();

            if (shot) {
                shots.push(shot);

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
            setIsLiveCapturing(false);
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
            setCapturedImageIsMirrored(Boolean(isMirrored));
            setOriginalCapturedImageIsMirrored(Boolean(isMirrored));

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

    // Keeping legacy for reference, but UI will use strip
    const handleStartCapture = handleStartStrip; // Alias for now

    // Utility: get center coords of webcam container for initial flying image position
    const getWebcamCenter = () => {
        const el = webcamRef.current && webcamRef.current.video ? webcamRef.current.video : webcamRef.current;
        if (!el) return { left: window.innerWidth / 2, top: window.innerHeight / 2 };
        const r = el.getBoundingClientRect();
        return { left: r.left + r.width / 2, top: r.top + r.height / 2 };
    };

    // Animate single shot from center to the hole index. Returns when animation completes.
    const animateShotToHole = async (index, src) => {
        // compute initial center and target hole center
        const c = getWebcamCenter();
        const holeEl = holeRefs[index]?.current;
        let target = { left: 80, top: window.innerHeight / 2 };
        if (holeEl) {
            const hr = holeEl.getBoundingClientRect();
            target = { left: hr.left + hr.width / 2, top: hr.top + hr.height / 2 };
        }

        const initLeft = c.left;
        const initTop = c.top;
        const deltaX = target.left - initLeft;
        const deltaY = target.top - initTop;

        const id = Date.now() + Math.random();
        const flying = { id, src, initLeft, initTop, deltaX, deltaY };

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
            {/* Left-side preview strip (desktop only) - ALWAYS VISIBLE for animation */}
            <div className="hidden lg:flex absolute left-6 top-1/2 transform -translate-y-1/2 z-200">
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
                    className="bg-white rounded-sm shadow-2xl border-4 border-white relative overflow-hidden"
                    style={{ padding: 'var(--strip-padding)' }}
                >
                    <div className="flex flex-col items-center relative z-10" style={{ gap: 'var(--strip-padding)' }}>
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <Motion.div
                                key={idx}
                                ref={holeRefs[idx]}
                                className="w-28 h-28 bg-gray-100 overflow-hidden flex items-center justify-center"
                                initial={{ scale: 1 }}
                                animate={landedShots[idx] ? { scale: [0.8, 1.05, 1] } : {}}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                            >
                                {capturedImages && capturedImages[idx] ? (
                                    <img src={capturedImages[idx]} alt={`strip-${idx}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">---</div>
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
            <div className={`w-full h-full flex flex-col items-center justify-center transition-opacity duration-300 ${hideUI ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {/* Camera Feed */}
                <div className="relative w-full h-full max-w-[80vh] max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/png"
                        className="w-full h-full object-cover"
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

                {/* center transition removed: using left preview -> center strip animation instead */}

                {/* Flying shot visuals (absolute images that animate to holes) */}
                {flyingShots.map(f => (
                    <Motion.img
                        key={f.id}
                        src={f.src}
                        initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                        animate={{ x: f.deltaX, y: f.deltaY, scale: [1, 1.05, 0.6], rotate: [0, 8, -6], opacity: 1 }}
                        transition={{ duration: 0.9, ease: 'easeInOut' }}
                        style={{ position: 'absolute', left: f.initLeft - 60, top: f.initTop - 80, width: 120, height: 160 }}
                        className="rounded-md shadow-2xl z-250 pointer-events-none border-2 border-white/20 object-cover"
                    />
                ))}

                {/* Controls */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 z-10">
                    {!isCountingDown && !isUploading && !isStripAnimating && (
                        <>
                            <Motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsMirrored(!isMirrored)}
                                className={`w-16 h-16 backdrop-blur-md rounded-full border-2 border-white/50 flex items-center justify-center group ${isMirrored ? 'bg-blue-400/20' : 'bg-white/20'}`}
                                title={isMirrored ? "Turn Mirroring Off" : "Turn Mirroring On"}
                            >
                                {/* Simple icon for mirror toggle */}
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${isMirrored ? 'text-blue-400' : 'text-white'}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                </svg>
                            </Motion.button>

                            <Motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setIsFlashEnabled(!isFlashEnabled)}
                                className={`w-16 h-16 backdrop-blur-md rounded-full border-2 border-white/50 flex items-center justify-center group ${isFlashEnabled ? 'bg-yellow-400/20' : 'bg-white/20'}`}
                                title={isFlashEnabled ? "Turn Flash Off" : "Turn Flash On"}
                            >
                                {/* Lightning bolt icon for flash */}
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${isFlashEnabled ? 'text-yellow-400' : 'text-white'}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                </svg>
                            </Motion.button>

                            {/* Export is always WYSIWYG (no toggle) - the preview equals exported image */}

                            <Motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleStartCapture}
                                className="w-20 h-20 bg-white rounded-full border-4 border-gray-200 shadow-xl flex items-center justify-center group"
                            >
                                <div className="w-16 h-16 bg-cute-pink rounded-full group-hover:bg-pink-400 transition-colors" />
                            </Motion.button>

                            {/* Spacer to balance the layout */}
                            <div className="w-16 h-16" />
                        </>
                    )}
                </div>

                {/* Decorative */}
                <div className="absolute top-4 left-4 text-white/50 font-mono text-sm">
                    LOGGED IN AS: {nickname}
                </div>
            </div>
        </div>
    );
};

export default Booth;

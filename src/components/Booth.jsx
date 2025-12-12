import React, { useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { uploadPhoto } from '../lib/supabase';

const Booth = () => {
    const webcamRef = useRef(null);
    const { setPhase, setCapturedImage, setCapturedImages, nickname, capturedImages, isMirrored, setIsMirrored, setCapturedImageIsMirrored, setOriginalCapturedImageIsMirrored, setIsFlashing, isFlashEnabled, setIsFlashEnabled } = useStore();

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
        // reset landed state for new capture sequence
        setLandedShots([false, false, false]);
        const shots = [];
        const TOTAL_SHOTS = 3;

        for (let i = 0; i < TOTAL_SHOTS; i++) {
            // Countdown
            setIsCountingDown(true);
            for (let c = 3; c > 0; c--) {
                setCount(c);
                playSound('beep');
                await delay(1000);
            }
            setIsCountingDown(false);

            // Capture
            const shot = await takeShot();
            if (shot) {
                shots.push(shot);

                // trigger fly animation for this shot to its hole
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

            // Brief pause/feedback between shots if not last
            if (i < TOTAL_SHOTS - 1) {
                await delay(1000); // Time to change pose!
            }
        }

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
                // play final strip animation then go to STUDIO
                await animateStripToBooth();
                setTimeout(() => setPhase('STUDIO'), 300);
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

        // Studio layout: 320px sidebar on desktop; center of editable canvas is the visual target
        let targetX = window.innerWidth / 2;
        let targetY = window.innerHeight / 2;

        if (window.innerWidth >= 768) {
            const sidebarWidth = 320;
            const canvasWidth = window.innerWidth - sidebarWidth;
            targetX = canvasWidth / 2;
        }

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

            const targetScale = Math.min(2.5, (window.innerHeight - 80) / 384);

            setStripAnimPath({
                inspect: inspectDelta,
                target: targetDelta,
                targetScale
            });
        }

        setIsStripAnimating(true);
        // Wait for animation to finish (inspect -> target)
        await new Promise(r => setTimeout(r, 2800));
    };

    return (
        <div className="h-full w-full bg-black relative overflow-hidden flex flex-col items-center justify-center">
            {/* Left-side preview strip (desktop only) */}
            <div className="hidden lg:flex absolute left-6 top-1/2 transform -translate-y-1/2 z-30">
                <Motion.div
                    ref={stripRef}
                    initial={{ scale: 1, rotate: 0, x: 0, y: 0 }}
                    animate={isStripAnimating ? {
                        x: [0, stripAnimPath.inspect.x, stripAnimPath.inspect.x, stripAnimPath.target.x],
                        y: [0, stripAnimPath.inspect.y, stripAnimPath.inspect.y + 15, stripAnimPath.target.y],
                        scale: [1.1, 1.35, 1.4, stripAnimPath.targetScale],
                        rotate: [0, -5, 5, 0],
                        opacity: 1,
                        transition: {
                            duration: 3.5,
                            ease: ["backOut", "easeInOut", "backInOut"],
                            times: [0, 0.25, 0.65, 1]
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
                                initial={{ scale: 1, opacity: 1 }}
                                animate={landedShots[idx] ? { scale: [0.8, 1.05, 1], opacity: [0, 1] } : {}}
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
                        className="absolute inset-0 w-full h-full bg-gradient-to-tr from-transparent via-white/60 to-transparent z-20 pointer-events-none skew-x-12"
                    />
                </Motion.div>
            </div>
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
                    className="rounded-md shadow-2xl z-50 pointer-events-none border-2 border-white/20 object-cover"
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
    );
};

export default Booth;

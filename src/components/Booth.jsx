import React, { useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { uploadPhoto } from '../lib/supabase';

const Booth = () => {
    const webcamRef = useRef(null);
    const { setPhase, setCapturedImage, nickname, capturedImage, isMirrored, setIsMirrored, setCapturedImageIsMirrored, setIsFlashing, isFlashEnabled, setIsFlashEnabled } = useStore();

    const [isCountingDown, setIsCountingDown] = useState(false);
    const [count, setCount] = useState(3);
    const [isUploading, setIsUploading] = useState(false);

    const [isTransitioning, setIsTransitioning] = useState(false);

    const handleStartCapture = () => {
        setIsCountingDown(true);
        setCount(3);

        const timer = setInterval(() => {
            setCount((prev) => {
                if (prev === 1) {
                    clearInterval(timer);
                    capture();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const capture = async () => {
        setIsCountingDown(false);

        // Start flash if enabled
        if (isFlashEnabled) {
            setIsFlashing(true);

            // End flash after 250ms total (50ms fade in + 200ms full flash)
            setTimeout(() => {
                setIsFlashing(false);
            }, 250);
        }

        // Snap at peak flash (after 50ms fade in)
        setTimeout(async () => {
            const imageSrc = webcamRef.current.getScreenshot();
            let finalImageSrc = imageSrc;

            // finalImageSrc will be the exact screenshot returned by react-webcam.
            // We enforce WYSIWYG: captured image will match the preview (mirrored or not).
            if (imageSrc) {
                finalImageSrc = imageSrc;

                // We enforce WYSIWYG: exported images match the preview. So no un-flipping here.
            }

            setCapturedImage(finalImageSrc);
            // Track whether the stored captured image is mirrored (matches preview)
            setCapturedImageIsMirrored(Boolean(isMirrored));

            // Start transition animation
            setIsTransitioning(true);

            // Upload to Supabase
            try {
                setIsUploading(true);

                // Convert the final (potentially flipped) base64 to blob for upload
                const res = await fetch(finalImageSrc);
                const uploadBlob = await res.blob();

                await uploadPhoto(nickname, uploadBlob);

                setIsUploading(false);

                // Wait a bit for the animation to be "felt" before switching
                setTimeout(() => {
                    setPhase('STUDIO');
                }, 1200);

            } catch (error) {
                console.error("Upload failed", error);
                setIsUploading(false);
                // Still move to studio even if upload fails
                setTimeout(() => {
                    setPhase('STUDIO');
                }, 1200);
            }
        }, 50);
    };

    return (
        <div className="h-full w-full bg-black relative overflow-hidden flex flex-col items-center justify-center">
            {/* Camera Feed */}
            <div className="relative w-full h-full max-w-4xl max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/png"
                    className="w-full h-full object-cover"
                    mirrored={isMirrored}
                    videoConstraints={{
                        facingMode: "user",
                        width: 1280,
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
                {isUploading && !isTransitioning && (
                    <div className="absolute inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                            <p className="text-white font-bold text-xl">Saving to the cloud...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Transition Overlay - The "Flying Photo" */}
            <AnimatePresence>
                {isTransitioning && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <Motion.div
                            initial={{ scale: 1, rotate: 0, opacity: 1 }}
                            animate={{
                                scale: [1, 1.1, 0.2],
                                rotate: [0, 10, -10, -5],
                                x: [0, 60, -60, -160],
                                y: [0, -80, 20, 0],
                                opacity: 1,
                                boxShadow: "0px 20px 50px rgba(0,0,0,0.5)"
                            }}
                            transition={{
                                duration: 1.2,
                                ease: "easeInOut",
                                times: [0, 0.4, 0.7, 1]
                            }}
                            className="relative w-full h-full max-w-4xl max-h-[80vh] rounded-3xl overflow-hidden border-4 border-white bg-black"
                        >
                            <img
                                src={capturedImage}
                                alt="Captured"
                                className="w-full h-full object-cover"
                            />
                        </Motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Controls */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 z-10">
                {!isCountingDown && !isUploading && !isTransitioning && (
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

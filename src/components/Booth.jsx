import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { uploadPhoto } from '../lib/supabase';

const Booth = () => {
    const webcamRef = useRef(null);
    const { setPhase, setCapturedImage, nickname } = useStore();

    const [isCountingDown, setIsCountingDown] = useState(false);
    const [count, setCount] = useState(3);
    const [isFlashing, setIsFlashing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isMirrored, setIsMirrored] = useState(true);

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

    const capture = useCallback(async () => {
        setIsCountingDown(false);
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 150);

        let imageSrc = webcamRef.current.getScreenshot();

        if (isMirrored && imageSrc) {
            // Manually flip the image if mirrored
            imageSrc = await new Promise((resolve) => {
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
                img.src = imageSrc;
            });
        }

        setCapturedImage(imageSrc);

        // Convert base64 to blob for upload
        try {
            setIsUploading(true);
            const res = await fetch(imageSrc);
            const blob = await res.blob();

            // Upload to Supabase "fire and forget" style or await it?
            // Let's await it to ensure it's saved before moving on, 
            // but we could also do it in background.
            // Given "no safety", let's just try to upload.
            await uploadPhoto(nickname, blob);

            setIsUploading(false);
            setPhase('STUDIO');
        } catch (error) {
            console.error("Upload failed", error);
            setIsUploading(false);
            // Still move to studio even if upload fails? 
            // Maybe show error? For now, let's just move on so user isn't stuck.
            setPhase('STUDIO');
        }

    }, [webcamRef, setCapturedImage, setPhase, nickname, isMirrored]);

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
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 1 }}
                            exit={{ scale: 2, opacity: 0 }}
                            key={count}
                            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                        >
                            <span className="text-9xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
                                {count}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Flash Overlay */}
                {isFlashing && (
                    <div className="absolute inset-0 bg-white z-30 animate-flash" />
                )}

                {/* Uploading Overlay */}
                {isUploading && (
                    <div className="absolute inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                            <p className="text-white font-bold text-xl">Saving to the cloud...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 z-10">
                {!isCountingDown && !isUploading && (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setIsMirrored(!isMirrored)}
                            className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/50 flex items-center justify-center group"
                            title={isMirrored ? "Turn Mirroring Off" : "Turn Mirroring On"}
                        >
                            {/* Simple icon for mirror toggle */}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleStartCapture}
                            className="w-20 h-20 bg-white rounded-full border-4 border-gray-200 shadow-xl flex items-center justify-center group"
                        >
                            <div className="w-16 h-16 bg-cute-pink rounded-full group-hover:bg-pink-400 transition-colors" />
                        </motion.button>

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

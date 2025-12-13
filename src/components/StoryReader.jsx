import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { storyDatabase } from '../data/stories';

const StoryReader = () => {
    const { userType, setPhase, nickname, setIsCameraPreloading } = useStore();
    const [chapterIndex, setChapterIndex] = useState(0);

    const story = storyDatabase[userType] || storyDatabase.DEFAULT;
    const currentChapter = story.chapters[chapterIndex];

    // Preload camera on last chapter
    useEffect(() => {
        if (chapterIndex === story.chapters.length - 1) {
            setIsCameraPreloading(true);
        } else {
            setIsCameraPreloading(false);
        }
        // Cleanup on unmount (or when leaving story phase) to be safe, though App.jsx handles it
        return () => setIsCameraPreloading(false);
    }, [chapterIndex, story.chapters.length, setIsCameraPreloading]);

    // State to track if user has manually interacted (halts auto-advance)
    const [isPaused, setIsPaused] = useState(false);

    // Blocking state for last chapter to ensure camera loads
    const [canAdvanceFromLast, setCanAdvanceFromLast] = useState(false);
    const isLastChapter = chapterIndex === story.chapters.length - 1;

    useEffect(() => {
        let setFalseTimer;
        let allowTimer;

        if (isLastChapter) {
            // Avoid calling setState synchronously inside the effect body by deferring
            setFalseTimer = setTimeout(() => setCanAdvanceFromLast(false), 0);
            allowTimer = setTimeout(() => setCanAdvanceFromLast(true), 1500); // minimal wait for camera
            return () => {
                clearTimeout(setFalseTimer);
                clearTimeout(allowTimer);
            };
        } else {
            // Defer to avoid synchronous setState in effect
            setFalseTimer = setTimeout(() => setCanAdvanceFromLast(true), 0);
            return () => clearTimeout(setFalseTimer);
        }
    }, [isLastChapter]);

    const handleNext = React.useCallback((e) => {
        e?.stopPropagation();
        setIsPaused(true); // User took control

        if (chapterIndex < story.chapters.length - 1) {
            setChapterIndex((prev) => prev + 1);
        } else {
            // Attempting to go to booth
            if (isLastChapter && !canAdvanceFromLast) return; // Block if too soon
            setPhase('BOOTH');
        }
    }, [chapterIndex, isLastChapter, canAdvanceFromLast, setPhase, story.chapters.length]);

    const handleBack = React.useCallback((e) => {
        e?.stopPropagation();
        setIsPaused(true); // User took control
        if (chapterIndex > 0) {
            setChapterIndex((prev) => prev - 1);
        }
    }, [chapterIndex]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.code === 'Space' || e.key === 'Enter') {
                e.preventDefault();
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handleBack();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [chapterIndex, isLastChapter, canAdvanceFromLast, handleNext, handleBack]); // Re-bind with latest state

    useEffect(() => {
        // Only auto-advance if not paused
        let timeout;
        // Don't auto-advance purely by time on the last chapter if we want to force the camera wait,
        // but actually the camera wait logic is handled by the block.
        // However, we should respect the longer delay if auto-advancing on last chapter.

        if (!isPaused && currentChapter && currentChapter.delay) {
            const delay = (isLastChapter && currentChapter.delay < 3500) ? 3500 : currentChapter.delay;

            timeout = setTimeout(() => {
                setChapterIndex((prev) => {
                    if (prev < story.chapters.length - 1) {
                        return prev + 1;
                    } else {
                        // Auto-advance also blocked by the logic? 
                        // Actually here we are inside the timeout, so if the delay passed, we go.
                        setPhase('BOOTH');
                        return prev;
                    }
                });
            }, delay);
        }
        return () => clearTimeout(timeout);
    }, [chapterIndex, currentChapter, isPaused, isLastChapter, setPhase, story.chapters.length]); // added deps

    // Parse text to replace variables
    const displayText = currentChapter.text.replace(/{nickname}/g, nickname);

    // Detect touch device
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    // Mouse parallax effect (disabled on touch devices for performance)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        if (isTouchDevice) return; // Skip parallax on touch devices
        const handleMouseMove = (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 20;
            const y = (e.clientY / window.innerHeight - 0.5) * 20;
            setMousePos({ x, y });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isTouchDevice]);

    // Swipe gesture support for mobile
    const [touchStart, setTouchStart] = useState(null);
    const handleTouchStart = (e) => {
        setTouchStart(e.touches[0].clientX);
    };
    const handleTouchEnd = (e) => {
        if (touchStart === null) return;
        const touchEnd = e.changedTouches[0].clientX;
        const diff = touchStart - touchEnd;
        const minSwipeDistance = 50;

        if (diff > minSwipeDistance) {
            // Swiped left -> go forward
            handleNext();
        } else if (diff < -minSwipeDistance) {
            // Swiped right -> go back
            handleBack();
        }
        setTouchStart(null);
    };

    return (
        <div
            className="h-screen w-full flex items-center justify-center cursor-default relative overflow-hidden transition-colors duration-1000"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
                backgroundColor: story.theme.background,
                color: story.theme.text
            }}
        >
            {/* Ambient Background Gradient */}
            <div
                className="absolute inset-0 opacity-50"
                style={{
                    background: `radial-gradient(circle at 50% 50%, ${story.theme.accent} 0%, transparent 70%)`
                }}
            />

            {/* Decorative Floating Elements with Parallax */}
            <Motion.div
                className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/20 rounded-full blur-3xl"
                animate={{
                    x: mousePos.x * -2,
                    y: mousePos.y * -2,
                    scale: [1, 1.1, 1],
                }}
                transition={{ scale: { duration: 4, repeat: Infinity } }}
            />
            <Motion.div
                className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/30 rounded-full blur-3xl"
                animate={{
                    x: mousePos.x * -1.5,
                    y: mousePos.y * -1.5,
                    scale: [1.1, 1, 1.1],
                }}
                transition={{ scale: { duration: 5, repeat: Infinity } }}
            />

            <AnimatePresence mode="wait">
                <Motion.div
                    key={chapterIndex}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05, y: -20 }}
                    transition={
                        isPaused
                            ? { type: "spring", stiffness: 400, damping: 30, mass: 0.8 } // Faster/Snappy for manual
                            : { type: "spring", stiffness: 120, damping: 20 } // Slow/Floaty for auto
                    }
                    className="max-w-4xl px-12 py-16 mx-4 text-center z-10 relative cursor-pointer"
                    onClick={handleNext} // Allow clicking text to advance
                    style={{
                        transform: `translate(${mousePos.x}px, ${mousePos.y}px)`
                    }}
                >
                    <p
                        className="text-4xl md:text-6xl font-black leading-tight tracking-tight drop-shadow-sm select-none"
                        style={{ color: story.theme.text }}
                    >
                        {displayText}
                    </p>
                </Motion.div>
            </AnimatePresence>

            {/* Cute Navigation Controls */}
            <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-12 z-50 pointer-events-none">
                <AnimatePresence>
                    {chapterIndex > 0 && (
                        <Motion.button
                            initial={{ opacity: 0, scale: 0.8, x: 20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: 20 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleBack}
                            className="pointer-events-auto w-16 h-16 rounded-full bg-white/80 backdrop-blur-md shadow-lg border-2 border-white flex items-center justify-center text-2xl text-cute-text hover:bg-white transition-colors"
                            aria-label="Previous"
                        >
                            👈
                        </Motion.button>
                    )}
                </AnimatePresence>

                <Motion.button
                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleNext}
                    disabled={isLastChapter && !canAdvanceFromLast}
                    className={`pointer-events-auto w-16 h-16 rounded-full bg-white/80 backdrop-blur-md shadow-lg border-2 border-white flex items-center justify-center text-2xl text-cute-text hover:bg-white transition-all ${(isLastChapter && !canAdvanceFromLast) ? 'opacity-50 grayscale cursor-wait' : ''}`}
                    aria-label="Next"
                >
                    {(isLastChapter && !canAdvanceFromLast)
                        ? <span className="animate-spin text-xl">⏳</span>
                        : (chapterIndex === story.chapters.length - 1 ? '✨' : '👉')
                    }
                </Motion.button>
            </div>

            {/* Progress Indicator */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-3 z-20">
                {story.chapters.map((_, idx) => (
                    <Motion.div
                        key={idx}
                        initial={false}
                        animate={{
                            width: idx === chapterIndex ? 40 : 12,
                            opacity: idx === chapterIndex ? 1 : 0.3,
                            backgroundColor: story.theme.text
                        }}
                        className="h-2 rounded-full shadow-sm transition-all duration-500"
                    />
                ))}
            </div>

            {/* Tap hint (only if not interacting) */}
            {!isPaused && (
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 2, duration: 1 }}
                    className="absolute bottom-6 text-sm font-medium tracking-widest uppercase opacity-40 mix-blend-multiply"
                >
                    Tap controls to pause
                </Motion.div>
            )}
        </div>
    );
};

export default StoryReader;

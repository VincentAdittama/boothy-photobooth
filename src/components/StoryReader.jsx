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
        return () => setIsCameraPreloading(false);
    }, [chapterIndex, story.chapters.length, setIsCameraPreloading]);

    // Active hold state (pauses auto-advance while true)
    const [isHolding, setIsHolding] = useState(false);

    // Blocking state for last chapter to ensure camera loads
    const [canAdvanceFromLast, setCanAdvanceFromLast] = useState(false);
    const isLastChapter = chapterIndex === story.chapters.length - 1;

    useEffect(() => {
        let setFalseTimer;
        let allowTimer;

        if (isLastChapter) {
            setFalseTimer = setTimeout(() => setCanAdvanceFromLast(false), 0);
            allowTimer = setTimeout(() => setCanAdvanceFromLast(true), 1500);
            return () => {
                clearTimeout(setFalseTimer);
                clearTimeout(allowTimer);
            };
        } else {
            setFalseTimer = setTimeout(() => setCanAdvanceFromLast(true), 0);
            return () => clearTimeout(setFalseTimer);
        }
    }, [isLastChapter]);

    const handleNext = React.useCallback((e) => {
        e?.stopPropagation();

        if (chapterIndex < story.chapters.length - 1) {
            setChapterIndex((prev) => prev + 1);
        } else {
            if (isLastChapter && !canAdvanceFromLast) return;
            setPhase('BOOTH');
        }
    }, [chapterIndex, isLastChapter, canAdvanceFromLast, setPhase, story.chapters.length]);

    const handleBack = React.useCallback((e) => {
        e?.stopPropagation();
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
    }, [handleNext, handleBack]);

    // Auto-advance logic
    useEffect(() => {
        // Do not set timer if holding
        if (isHolding && !isLastChapter) return;

        let timeout;
        if (currentChapter && currentChapter.delay) {
            const delay = (isLastChapter && currentChapter.delay < 3500) ? 3500 : currentChapter.delay;

            timeout = setTimeout(() => {
                if (isLastChapter) {
                    setPhase('BOOTH');
                } else {
                    setChapterIndex((prev) => prev + 1);
                }
            }, delay);
        }
        return () => clearTimeout(timeout);
    }, [chapterIndex, currentChapter, isHolding, isLastChapter, setPhase]);

    // Parse text
    const displayText = currentChapter.text.replace(/{nickname}/g, nickname);

    // Mouse parallax (desktop only)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        if (isTouchDevice) return;
        const handleMouseMove = (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 20;
            const y = (e.clientY / window.innerHeight - 0.5) * 20;
            setMousePos({ x, y });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isTouchDevice]);

    // Pointer Interaction Logic (Tap, Hold, Swipe)
    const pointerRef = React.useRef({ startX: 0, startTime: 0 });

    const handlePointerDown = (e) => {
        // Verify we are not clicking a button
        if (e.target.closest('button')) return;

        setIsHolding(true);
        pointerRef.current = {
            startX: e.clientX,
            startTime: Date.now()
        };
    };

    const handlePointerUp = (e) => {
        // If not holding (e.g. invalid start), ignore
        if (!isHolding) return;

        setIsHolding(false);

        // Verify we are not clicking a button (though down check covers most)
        if (e.target.closest('button')) return;

        const endTime = Date.now();
        const endX = e.clientX;
        const diffX = pointerRef.current.startX - endX;
        const duration = endTime - pointerRef.current.startTime;
        const absDiff = Math.abs(diffX);
        const minSwipeDistance = 50;

        if (absDiff > minSwipeDistance) {
            // Swipe Detected
            if (diffX > 0) {
                handleNext();
            } else {
                handleBack();
            }
        } else {
            // No Swipe
            if (duration < 200) {
                // Short Tap -> Next
                handleNext();
            }
            // If duration > 200 (Hold), we just released, so auto-advance timer resumes via effect
        }
    };

    const handlePointerLeave = () => {
        if (isHolding) setIsHolding(false);
    };

    return (
        <div
            className="h-screen w-full flex items-center justify-center cursor-default relative overflow-hidden transition-colors duration-1000 select-none touch-none"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
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

            {/* Decorative Floating Elements with Parallax - Optimized for Performance */}
            {/* Using radial gradients instead of blur filters for mobile performance */}
            <Motion.div
                className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                    willChange: 'transform' // Hardware acceleration hint
                }}
                animate={{
                    x: mousePos.x * -2,
                    y: mousePos.y * -2,
                    scale: [1, 1.1, 1],
                }}
                transition={{ scale: { duration: 4, repeat: Infinity, ease: "linear" } }}
            />
            <Motion.div
                className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
                style={{
                    background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
                    willChange: 'transform'
                }}
                animate={{
                    x: mousePos.x * -1.5,
                    y: mousePos.y * -1.5,
                    scale: [1.1, 1, 1.1],
                }}
                transition={{ scale: { duration: 5, repeat: Infinity, ease: "linear" } }}
            />

            <AnimatePresence mode="wait">
                <Motion.div
                    key={chapterIndex}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.05, y: -20 }}
                    transition={{
                        duration: 0.4,
                        ease: "easeOut" // Simpler easing than spring for better consistency on low-end
                    }}
                    className="max-w-4xl px-12 py-16 mx-4 text-center z-10 relative"
                    style={{
                        transform: `translate(${mousePos.x}px, ${mousePos.y}px)`,
                        willChange: 'transform, opacity'
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

            {/* Cute Navigation Controls - Explicit Buttons */}
            <div className="absolute bottom-40 left-0 right-0 flex justify-center gap-12 z-50 pointer-events-none">
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
            <div className="absolute bottom-28 left-0 right-0 flex justify-center gap-3 z-20">
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

            {/* Hold hint */}
            {isHolding && (
                <Motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-12 right-12 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full text-white text-sm font-medium"
                >
                    Paused ⏸️
                </Motion.div>
            )}
        </div>
    );
};

export default StoryReader;

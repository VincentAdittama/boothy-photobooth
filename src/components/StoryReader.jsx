import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { storyDatabase } from '../data/stories';

const StoryReader = () => {
    const { userType, setPhase } = useStore();
    const [chapterIndex, setChapterIndex] = useState(0);

    const story = storyDatabase[userType] || storyDatabase.DEFAULT;
    const currentChapter = story.chapters[chapterIndex];

    useEffect(() => {
        let timeout;
        if (currentChapter && currentChapter.delay) {
            timeout = setTimeout(() => {
                handleNext();
            }, currentChapter.delay);
        }
        return () => clearTimeout(timeout);
    }, [chapterIndex, currentChapter]);

    const handleNext = () => {
        if (chapterIndex < story.chapters.length - 1) {
            setChapterIndex((prev) => prev + 1);
        } else {
            setPhase('BOOTH');
        }
    };

    return (
        <div
            className="h-screen w-full flex items-center justify-center cursor-pointer relative overflow-hidden transition-colors duration-1000"
            onClick={handleNext}
            style={{
                backgroundColor: story.theme.background,
                color: story.theme.text
            }}
        >
            {/* Decorative Background Elements */}
            <div className="absolute top-10 left-10 w-32 h-32 bg-white/30 rounded-full blur-2xl animate-bounce-slight" />
            <div className="absolute bottom-10 right-10 w-48 h-48 bg-white/30 rounded-full blur-2xl animate-bounce-slight" style={{ animationDelay: '1s' }} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={chapterIndex}
                    initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 1.1, rotate: 2 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="max-w-3xl px-12 py-16 bg-white/60 backdrop-blur-md rounded-[3rem] shadow-xl border-4 border-white mx-4 text-center z-10 relative"
                >
                    {/* Cute Sticker Decoration */}
                    <div className="absolute -top-6 -right-6 text-4xl animate-bounce-slight">
                        ✨
                    </div>

                    <p
                        className="text-3xl md:text-5xl font-bold leading-relaxed tracking-wide text-cute-text"
                    >
                        {currentChapter.text}
                    </p>
                </motion.div>
            </AnimatePresence>

            {/* Progress Indicator */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-3">
                {story.chapters.map((_, idx) => (
                    <motion.div
                        key={idx}
                        initial={false}
                        animate={{
                            width: idx === chapterIndex ? 32 : 12,
                            backgroundColor: idx === chapterIndex ? story.theme.accent : '#e5e7eb'
                        }}
                        className="h-3 rounded-full shadow-sm"
                    />
                ))}
            </div>
        </div>
    );
};

export default StoryReader;

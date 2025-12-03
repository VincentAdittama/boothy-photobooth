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
            className="h-screen w-full flex items-center justify-center cursor-pointer relative overflow-hidden"
            onClick={handleNext}
            style={{
                backgroundColor: story.theme.background,
                color: story.theme.text
            }}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={chapterIndex}
                    initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="max-w-2xl px-8 text-center z-10"
                >
                    <p
                        className="text-3xl md:text-5xl font-light leading-relaxed tracking-wide"
                        style={{ textShadow: `0 0 20px ${story.theme.accent}40` }}
                    >
                        {currentChapter.text}
                    </p>
                </motion.div>
            </AnimatePresence>

            {/* Progress Indicator */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2">
                {story.chapters.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-1 transition-all duration-500 rounded-full ${idx === chapterIndex ? 'w-8 bg-white' : 'w-2 bg-white/20'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default StoryReader;

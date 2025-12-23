import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const PARTICLE_OFFSETS = [
    { x: -26, y: -18 },
    { x: 22, y: -24 },
    { x: -18, y: 20 },
    { x: 28, y: 16 },
    { x: 0, y: -30 },
    { x: 0, y: 28 },
];

/**
 * TrashZone - Animated trash bin that appears when dragging stickers
 *
 * Props:
 * - side: 'left' | 'right' - which side of the screen
 * - isVisible: boolean - controls entrance/exit animation
 * - isActive: boolean - highlight when sticker hovers over
 * - zoneRef: ref - for hit detection bounds
 * - isDesktop: boolean - if true, positions closer to center (near photostrip)
 */
const TrashZone = ({ side, isVisible, isActive, zoneRef, isDesktop = false }) => {
    const isLeft = side === 'left';

    // Animation variants
    const containerVariants = {
        hidden: {
            x: isLeft ? -100 : 100,
            opacity: 0,
            scale: 0.5,
        },
        visible: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: {
                type: 'spring',
                stiffness: 400,
                damping: 25,
                mass: 0.8,
            }
        },
        exit: {
            x: isLeft ? -100 : 100,
            opacity: 0,
            scale: 0.5,
            transition: {
                type: 'spring',
                stiffness: 400,
                damping: 30,
            }
        }
    };

    // Floating animation for idle state
    const floatVariants = {
        float: {
            y: [0, -8, 0],
            rotate: isLeft ? [-2, 2, -2] : [2, -2, 2],
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
            }
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <Motion.div
                    ref={zoneRef}
                    className={`fixed top-1/2 -translate-y-1/2 z-100 pointer-events-none
                        ${isDesktop
                            ? (isLeft ? 'left-[calc(50%-180px)]' : 'right-[calc(50%-180px)]')
                            : (isLeft ? 'left-2' : 'right-2')
                        }`}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <Motion.div
                        variants={floatVariants}
                        animate="float"
                        className={`relative w-16 h-20 rounded-2xl flex flex-col items-center justify-center gap-1
                            transition-all duration-200 ease-out
                            ${isActive
                                ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)] scale-110'
                                : 'bg-gray-800/80 shadow-lg'
                            }`}
                    >
                        {/* Trash bin icon */}
                        <Motion.div
                            className="relative"
                            animate={isActive ? {
                                scale: [1, 1.2, 1],
                                rotate: [0, -10, 10, 0],
                            } : {}}
                            transition={{
                                duration: 0.3,
                                repeat: isActive ? Infinity : 0,
                                repeatDelay: 0.2,
                            }}
                        >
                            {/* Lid */}
                            <Motion.div
                                className={`w-10 h-2 rounded-t-lg mb-0.5 ${isActive ? 'bg-white' : 'bg-gray-400'}`}
                                animate={isActive ? {
                                    rotateX: [0, -30, 0],
                                    y: [0, -3, 0]
                                } : {}}
                                transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 0.3 }}
                                style={{ transformOrigin: 'bottom' }}
                            />
                            {/* Body */}
                            <div className={`w-9 h-10 mx-auto rounded-b-lg relative overflow-hidden
                                ${isActive ? 'bg-white' : 'bg-gray-400'}`}
                            >
                                {/* Lines on bin */}
                                <div className="absolute inset-x-2 top-2 bottom-2 flex justify-between">
                                    <div className={`w-0.5 rounded ${isActive ? 'bg-red-400' : 'bg-gray-600'}`} />
                                    <div className={`w-0.5 rounded ${isActive ? 'bg-red-400' : 'bg-gray-600'}`} />
                                    <div className={`w-0.5 rounded ${isActive ? 'bg-red-400' : 'bg-gray-600'}`} />
                                </div>
                            </div>
                        </Motion.div>

                        {/* Label */}
                        <span className={`text-[10px] font-bold uppercase tracking-wider
                            ${isActive ? 'text-white' : 'text-gray-400'}`}
                        >
                            Delete
                        </span>

                        {/* Glow ring when active */}
                        {isActive && (
                            <Motion.div
                                className="absolute inset-0 rounded-2xl border-2 border-white/50"
                                animate={{
                                    scale: [1, 1.15, 1],
                                    opacity: [0.5, 0, 0.5],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: 'easeOut',
                                }}
                            />
                        )}

                        {/* Particle effects when active */}
                        {isActive && (
                            <>
                                {PARTICLE_OFFSETS.map((p, i) => (
                                    <Motion.div
                                        key={i}
                                        className="absolute w-1.5 h-1.5 bg-red-300 rounded-full"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            scale: [0, 1, 0],
                                            x: [0, p.x],
                                            y: [0, p.y],
                                        }}
                                        transition={{
                                            duration: 0.8,
                                            repeat: Infinity,
                                            delay: i * 0.15,
                                            ease: 'easeOut',
                                        }}
                                    />
                                ))}
                            </>
                        )}
                    </Motion.div>
                </Motion.div>
            )}
        </AnimatePresence>
    );
};

export default TrashZone;

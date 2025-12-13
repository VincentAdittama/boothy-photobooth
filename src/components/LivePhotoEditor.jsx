import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';

/**
 * LivePhotoEditor - Timeline scrubber for selecting the best frame from a Live Photo
 * 
 * Props:
 * - photoIndex: which photo in the strip is being edited (0, 1, or 2)
 * - onClose: callback when editor is closed (cancel or confirm)
 */
const LivePhotoEditor = ({ photoIndex, onClose }) => {
    const {
        livePhotoFrames,
        selectedFrameIndices,
        setSelectedFrameIndex,
        updateCapturedImage,
        capturedImages,
        capturedImageIsMirrored,
        originalCapturedImageIsMirrored,
        originalCapturedImageIsMirroredArray
    } = useStore();

    // Determine if we need to flip the preview (same logic as Studio.jsx)
    const shouldFlip = capturedImageIsMirrored !== (originalCapturedImageIsMirroredArray?.[photoIndex] ?? originalCapturedImageIsMirrored);

    const frames = livePhotoFrames[photoIndex] || [];
    const initialFrameIndex = selectedFrameIndices[photoIndex] || 24; // Default to snap moment
    const [currentFrameIndex, setCurrentFrameIndex] = useState(initialFrameIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const timelineRef = useRef(null);
    const playIntervalRef = useRef(null);

    // Calculate time offset from center (snap moment is at index 24)
    const snapIndex = 24;
    const fps = 12;
    const getTimeOffset = (frameIndex) => {
        const offsetFrames = frameIndex - snapIndex;
        const seconds = offsetFrames / fps;
        return seconds.toFixed(2);
    };

    const currentFrame = frames[currentFrameIndex] || capturedImages[photoIndex];

    // Handle timeline scrubbing
    const handleTimelineInteraction = useCallback((clientX) => {
        if (!timelineRef.current || frames.length === 0) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const frameIndex = Math.floor(percentage * (frames.length - 1));
        setCurrentFrameIndex(frameIndex);
    }, [frames.length]);

    // Playback controls
    const startPlayback = () => {
        if (frames.length === 0) return;
        setIsPlaying(true);
        let frameIdx = 0;
        playIntervalRef.current = setInterval(() => {
            setCurrentFrameIndex(frameIdx);
            frameIdx = (frameIdx + 1) % frames.length;
        }, 1000 / fps);
    };

    const stopPlayback = useCallback(() => {
        if (playIntervalRef.current) {
            clearInterval(playIntervalRef.current);
            playIntervalRef.current = null;
        }
        setIsPlaying(false);
    }, [setIsPlaying]);

    const togglePlayback = () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            startPlayback();
        }
    };

    const handleMouseDown = useCallback((e) => {
        setIsDragging(true);
        stopPlayback();
        handleTimelineInteraction(e.clientX);
    }, [handleTimelineInteraction, stopPlayback, setIsDragging]);

    const handleMouseMove = useCallback((e) => {
        if (isDragging) {
            handleTimelineInteraction(e.clientX);
        }
    }, [isDragging, handleTimelineInteraction]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, [setIsDragging]);

    const handleTouchStart = useCallback((e) => {
        setIsDragging(true);
        stopPlayback();
        handleTimelineInteraction(e.touches[0].clientX);
    }, [handleTimelineInteraction, stopPlayback, setIsDragging]);

    const handleTouchMove = useCallback((e) => {
        if (isDragging) {
            handleTimelineInteraction(e.touches[0].clientX);
        }
    }, [isDragging, handleTimelineInteraction]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
    }, [setIsDragging]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, []);

    // Global mouse/touch handlers for dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    // Handle confirm - update the captured image with selected frame
    const handleConfirm = () => {
        const selectedFrame = frames[currentFrameIndex];
        if (selectedFrame) {
            setSelectedFrameIndex(photoIndex, currentFrameIndex);
            updateCapturedImage(photoIndex, selectedFrame);
        }
        onClose();
    };

    // Handle cancel - restore original and close
    const handleCancel = () => {
        onClose();
    };

    // Calculate progress percentage
    const progressPercentage = frames.length > 0
        ? (currentFrameIndex / (frames.length - 1)) * 100
        : 50;

    const timeOffset = getTimeOffset(currentFrameIndex);
    const timeDisplay = parseFloat(timeOffset) >= 0 ? `+${timeOffset}s` : `${timeOffset}s`;

    if (frames.length === 0) {
        return (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
                <div className="text-white text-center">
                    <p className="text-xl mb-4">No Live Photo frames available</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
        >
            {/* Header */}
            <div className="shrink-0 p-4 flex items-center justify-between">
                <h2 className="text-white text-xl font-bold">Live Photo Editor</h2>
                <div className="flex items-center gap-2">
                    <span className="text-white/60 text-sm">Photo {photoIndex + 1}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-mono ${parseFloat(timeOffset) === 0
                        ? 'bg-cute-pink text-white'
                        : 'bg-white/20 text-white'
                        }`}>
                        {timeDisplay}
                    </span>
                </div>
            </div>

            {/* Frame Preview */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                <div className="relative w-full max-w-[360px] aspect-square">
                    <img
                        src={currentFrame}
                        alt={`Frame ${currentFrameIndex + 1}`}
                        className="w-full h-full object-cover rounded-xl shadow-2xl"
                        style={{ transform: shouldFlip ? 'scaleX(-1)' : 'none' }}
                    />
                    {/* Snap moment indicator */}
                    {currentFrameIndex === snapIndex && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-cute-pink text-white text-sm font-bold rounded-full">
                            📸 Snap Moment
                        </div>
                    )}
                </div>
            </div>

            {/* Timeline Scrubber */}
            <div className="shrink-0 px-4 sm:px-6 py-4 bg-black/50">
                {/* Time labels with snap button */}
                <div className="flex justify-between items-center text-white/60 text-xs mb-2 font-mono">
                    <span>-2.0s</span>
                    <button
                        onClick={() => setCurrentFrameIndex(snapIndex)}
                        className="text-cute-pink font-bold hover:bg-cute-pink hover:text-white px-3 py-2 sm:py-1 rounded-full transition-colors min-h-[44px] sm:min-h-0"
                    >
                        ● SNAP
                    </button>
                    <span>+2.0s</span>
                </div>

                {/* Timeline track - taller on mobile for easier touch */}
                <div
                    ref={timelineRef}
                    className="relative h-20 sm:h-16 bg-white/10 rounded-xl overflow-hidden cursor-pointer touch-none"
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                >
                    {/* Frame thumbnails (show every 4th frame for performance) */}
                    <div className="absolute inset-0 flex">
                        {frames.filter((_, i) => i % 4 === 0).map((frame, i) => (
                            <div
                                key={i}
                                className="flex-1 h-full"
                                style={{
                                    backgroundImage: `url(${frame})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    opacity: 0.6,
                                    transform: shouldFlip ? 'scaleX(-1)' : 'none'
                                }}
                            />
                        ))}
                    </div>

                    {/* Progress fill */}
                    <div
                        className="absolute left-0 top-0 h-full bg-cute-pink/30 pointer-events-none"
                        style={{ width: `${progressPercentage}%` }}
                    />

                    {/* Snap moment marker */}
                    <div
                        className="absolute top-0 h-full w-0.5 bg-cute-pink pointer-events-none"
                        style={{ left: '50%' }}
                    />

                    {/* Scrubber handle */}
                    <Motion.div
                        className="absolute top-0 h-full flex items-center pointer-events-none"
                        style={{ left: `${progressPercentage}%` }}
                        animate={{ x: '-50%' }}
                    >
                        <div className="w-4 h-full bg-white rounded-sm shadow-lg flex items-center justify-center">
                            <div className="w-0.5 h-8 bg-gray-400 rounded-full" />
                        </div>
                    </Motion.div>
                </div>

                {/* Frame counter */}
                <div className="flex justify-between items-center mt-2">
                    <span className="text-white/40 text-xs">
                        Frame {currentFrameIndex + 1} / {frames.length}
                    </span>
                    <button
                        onClick={togglePlayback}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                    >
                        {isPlaying ? '⏸ Pause' : '▶ Play'}
                    </button>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="shrink-0 p-4 sm:p-6 flex gap-3 sm:gap-4">
                <button
                    onClick={handleCancel}
                    className="flex-1 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors min-h-[48px]"
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirm}
                    className="flex-1 py-4 bg-cute-pink text-white font-bold rounded-xl hover:bg-pink-400 transition-colors shadow-lg min-h-[48px]"
                >
                    Use This Frame
                </button>
            </div>
        </Motion.div>
    );
};

export default LivePhotoEditor;

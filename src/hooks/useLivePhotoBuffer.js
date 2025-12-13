import { useRef, useCallback, useState, useMemo } from 'react';

/**
 * Hook for capturing "Live Photo" style frame buffers.
 * Continuously captures frames at specified FPS, maintaining a circular buffer.
 * On capture trigger, saves the current buffer (before frames) and continues
 * capturing for duration more seconds (after frames).
 * 
 * @param {React.RefObject} webcamRef - Reference to react-webcam component
 * @param {Object} options - Configuration options
 * @param {number} options.fps - Frames per second (default: 12)
 * @param {number} options.duration - Seconds before AND after snap (default: 2)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.5)
 * @param {number} options.scale - Scale factor for buffer frames (default: 0.5)
 * @param {boolean} options.isMirrored - Whether to mirror the frames horizontally (default: true)
 */
const useLivePhotoBuffer = (webcamRef, options = {}) => {
    const {
        fps = 12,
        duration = 2,
        quality = 0.5,
        scale = 0.5,
        isMirrored = true
    } = options;

    const framesPerBuffer = fps * duration; // Frames before OR after snap
    const totalFrames = framesPerBuffer * 2; // Total frames in complete buffer
    const intervalMs = 1000 / fps;

    // Circular buffer for "before" frames
    const bufferRef = useRef([]);
    const bufferIndexRef = useRef(0);
    const intervalIdRef = useRef(null);

    // Store current mirror state for use in callbacks
    const isMirroredRef = useRef(isMirrored);
    isMirroredRef.current = isMirrored;

    // State
    const [isBuffering, setIsBuffering] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    // Helper: unmirror a dataURL (flip horizontally)
    const unmirrorDataURL = useCallback((dataURL) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                // flip horizontally
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            };
            img.src = dataURL;
        });
    }, []);

    // Capture a single low-res frame (with mirror transform if needed)
    const captureFrame = useCallback(() => {
        if (!webcamRef.current) return null;

        const video = webcamRef.current.video;
        if (!video || video.readyState !== 4) return null;

        // Create scaled canvas for lower memory usage
        const canvas = document.createElement('canvas');
        const targetWidth = Math.floor(video.videoWidth * scale);
        const targetHeight = Math.floor(video.videoHeight * scale);
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');

        // Capture always unmirrored; display logic will handle mirroring
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        return canvas.toDataURL('image/jpeg', quality);
    }, [webcamRef, scale, quality]);

    // Start continuous buffering (call when entering booth)
    const startBuffering = useCallback(() => {
        if (intervalIdRef.current) return; // Already buffering

        bufferRef.current = new Array(framesPerBuffer).fill(null);
        bufferIndexRef.current = 0;
        setIsBuffering(true);

        intervalIdRef.current = setInterval(() => {
            const frame = captureFrame();
            if (frame) {
                bufferRef.current[bufferIndexRef.current] = frame;
                bufferIndexRef.current = (bufferIndexRef.current + 1) % framesPerBuffer;
            }
        }, intervalMs);
    }, [captureFrame, framesPerBuffer, intervalMs]);

    // Stop buffering (call when leaving booth)
    const stopBuffering = useCallback(() => {
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }
        bufferRef.current = [];
        bufferIndexRef.current = 0;
        setIsBuffering(false);
    }, []);

    // Capture with buffer: saves current "before" frames, captures "after" frames
    // Returns Promise that resolves with complete frame array (48 frames)
    const captureWithBuffer = useCallback(() => {
        return new Promise((resolve) => {
            setIsCapturing(true);

            // Pause the continuous buffer - we'll handle this manually now
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                intervalIdRef.current = null;
            }

            // Extract "before" frames in correct chronological order
            const currentIdx = bufferIndexRef.current;
            const rawBefore = [];
            for (let i = 0; i < framesPerBuffer; i++) {
                const idx = (currentIdx + i) % framesPerBuffer;
                rawBefore.push(bufferRef.current[idx] || null);
            }

            // If we have no prior frames (startup), capture a fallback frame
            let beforeFrames = [];
            const nonNull = rawBefore.filter(Boolean);
            if (nonNull.length === 0) {
                const fallback = captureFrame() || webcamRef.current?.getScreenshot() || null;
                beforeFrames = new Array(framesPerBuffer).fill(fallback);
            } else {
                // Use the most recent available frame to replace any nulls so we don't get blanks
                const latest = nonNull[nonNull.length - 1];
                beforeFrames = rawBefore.map((f) => f || latest);
            }

            // Capture the snap moment at full resolution
            // We capture this synchronously(ish) so it's the specific moment user clicked
            let snapFrame = webcamRef.current?.getScreenshot();

            // Prepare a promise to handle the potentially async processing of the snap (unmirroring)
            // This runs in PARALLEL with the after-frame capture loop
            const processSnapPromise = new Promise((resolveSnap) => {
                if (snapFrame && isMirroredRef.current) {
                    unmirrorDataURL(snapFrame).then((unsnap) => {
                        resolveSnap(unsnap);
                    }).catch((e) => {
                        console.warn('Failed to unmirror snapFrame', e);
                        resolveSnap(snapFrame);
                    });
                } else {
                    resolveSnap(snapFrame);
                }
            });

            // Start capturing "after" frames IMMEDIATELY
            const afterFramesPromise = new Promise((resolveAfter) => {
                const frames = [];
                let count = 0;

                // Use a standard interval for capturing
                const afterId = setInterval(() => {
                    const frame = captureFrame();
                    if (frame) {
                        frames.push(frame);
                    }
                    count++;

                    if (count >= framesPerBuffer) {
                        clearInterval(afterId);

                        // Pad if needed (unlikely if interval works well, but safe)
                        while (frames.length < framesPerBuffer) {
                            frames.push(frames[frames.length - 1] || null);
                        }
                        resolveAfter(frames);
                    }
                }, intervalMs);
            });

            // Wait for BOTH the capture loop AND the image processing to finish
            Promise.all([processSnapPromise, afterFramesPromise]).then(([processedSnap, afterFrames]) => {
                setIsCapturing(false);

                // Final assembly
                // Pad after frames with snap if they ended up null (fallback)
                const finalAfterFrames = afterFrames.map(f => f || processedSnap);

                // Combine: before + snap + after
                const allFrames = [...beforeFrames, ...finalAfterFrames];

                // Insert the high-res snap at the junction point
                // (Index = framesPerBuffer). This effectively replaces the first "after" frame 
                // or sits between before and after. 
                // In the previous logic, it replaced the element at index `framesPerBuffer`.
                const snapIndex = framesPerBuffer;
                if (processedSnap) {
                    allFrames[snapIndex] = processedSnap;
                }

                // Resume continuous buffering for next shot
                bufferRef.current = beforeFrames.slice();
                bufferIndexRef.current = 0;
                startBuffering(); // Re-use startBuffering logic

                resolve({
                    frames: allFrames,
                    snapIndex: snapIndex,
                    snapFrame: processedSnap
                });
            });
        });
    }, [webcamRef, captureFrame, framesPerBuffer, intervalMs, unmirrorDataURL, startBuffering]);

    // Get current buffer state (for debugging)
    const getBufferState = useCallback(() => ({
        bufferSize: bufferRef.current.filter(Boolean).length,
        targetSize: framesPerBuffer,
        isBuffering,
        isCapturing
    }), [framesPerBuffer, isBuffering, isCapturing]);

    return useMemo(() => ({
        startBuffering,
        stopBuffering,
        captureWithBuffer,
        getBufferState,
        isBuffering,
        isCapturing,
        totalFrames,
        snapIndex: framesPerBuffer, // The index of the snap moment in the final array
        framesPerBuffer,
        fps
    }), [
        startBuffering,
        stopBuffering,
        captureWithBuffer,
        getBufferState,
        isBuffering,
        isCapturing,
        totalFrames,
        framesPerBuffer,
        fps
    ]);
};

export default useLivePhotoBuffer;

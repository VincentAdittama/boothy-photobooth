import { useRef, useCallback, useState } from 'react';

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
            const beforeFrames = [];
            const currentIdx = bufferIndexRef.current;
            for (let i = 0; i < framesPerBuffer; i++) {
                const idx = (currentIdx + i) % framesPerBuffer;
                const frame = bufferRef.current[idx];
                if (frame) {
                    beforeFrames.push(frame);
                }
            }

            // Pad if we don't have enough frames yet
            while (beforeFrames.length < framesPerBuffer) {
                beforeFrames.unshift(beforeFrames[0] || null);
            }

            // Capture the snap moment at full resolution
            let snapFrame = webcamRef.current?.getScreenshot();

            const continueWithSnap = (snap) => {
                // Now capture "after" frames
                const afterFrames = [];
                let afterCaptureCount = 0;

                const afterInterval = setInterval(() => {
                    const frame = captureFrame();
                    if (frame) {
                        afterFrames.push(frame);
                    }
                    afterCaptureCount++;

                    if (afterCaptureCount >= framesPerBuffer) {
                        clearInterval(afterInterval);
                        setIsCapturing(false);

                        // Pad after frames if needed
                        while (afterFrames.length < framesPerBuffer) {
                            afterFrames.push(afterFrames[afterFrames.length - 1] || snap);
                        }

                        // Combine: before + snap + after (snap replaces center frame)
                        const allFrames = [...beforeFrames, ...afterFrames];
                        // Replace center frame with high-res snap
                        const snapIndex = framesPerBuffer; // First frame of "after" is the snap moment
                        if (snap) {
                            allFrames[snapIndex] = snap;
                        }

                        // Resume continuous buffering for next shot
                        bufferRef.current = new Array(framesPerBuffer).fill(null);
                        bufferIndexRef.current = 0;
                        intervalIdRef.current = setInterval(() => {
                            const f = captureFrame();
                            if (f) {
                                bufferRef.current[bufferIndexRef.current] = f;
                                bufferIndexRef.current = (bufferIndexRef.current + 1) % framesPerBuffer;
                            }
                        }, intervalMs);

                        resolve({
                            frames: allFrames,
                            snapIndex: snapIndex,
                            snapFrame: snap
                        });
                    }
                }, intervalMs);
            };

            if (snapFrame && isMirroredRef.current) {
                unmirrorDataURL(snapFrame).then((unsnap) => {
                    continueWithSnap(unsnap);
                }).catch((e) => {
                    console.warn('Failed to unmirror snapFrame', e);
                    continueWithSnap(snapFrame);
                });
            } else {
                continueWithSnap(snapFrame);
            }
        });
    }, [webcamRef, captureFrame, framesPerBuffer, intervalMs, unmirrorDataURL]);

    // Get current buffer state (for debugging)
    const getBufferState = useCallback(() => ({
        bufferSize: bufferRef.current.filter(Boolean).length,
        targetSize: framesPerBuffer,
        isBuffering,
        isCapturing
    }), [framesPerBuffer, isBuffering, isCapturing]);

    return {
        startBuffering,
        stopBuffering,
        captureWithBuffer,
        getBufferState,
        isBuffering,
        isCapturing,
        totalFrames,
        snapIndex: framesPerBuffer // The index of the snap moment in the final array
    };
};

export default useLivePhotoBuffer;

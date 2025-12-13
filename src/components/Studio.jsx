import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Transformer, Rect } from 'react-konva';
import { useStore } from '../store';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import URLImage from './URLImage';
import { getStickers } from '../data/stickers';
import { calculateStripLayout } from '../utils/stripLayout';
import LivePhotoEditor from './LivePhotoEditor';

const Studio = () => {
    const {
        capturedImage, setPhase, capturedImageIsMirrored, setCapturedImageIsMirrored,
        capturedImages, livePhotoFrames,
        currentlyEditingPhotoIndex, setCurrentlyEditingPhotoIndex, setIsRetakeSelecting
    } = useStore();
    const stageRef = useRef(null);
    const [stickers, setStickers] = useState([]);
    const [selectedId, selectShape] = useState(null);
    const transformerRef = useRef(null);

    // We need refs for all stickers to attach transformer
    const stickersRefs = useRef({});

    // History for undo/redo (stores JSON snapshots of `stickers`)
    const historyRef = useRef({ stack: [], index: -1 });
    const isApplyingHistoryRef = useRef(false);
    const MAX_HISTORY = 200;

    const [layout, setLayout] = useState({ width: 800, height: 800, photoSize: 0, pad: 0, gap: 0, border: 0 });
    const containerRef = useRef(null);

    // Check if we are in strip mode
    const isStrip = capturedImages && capturedImages.length > 1;

    // Check if we have Live Photo frames available
    const hasLivePhotos = livePhotoFrames && livePhotoFrames.length > 0;

    // Check if currently editing a photo
    const isEditing = currentlyEditingPhotoIndex !== null;

    const [isHoveringSticker, setIsHoveringSticker] = useState(false);
    const [isDraggingSticker, setIsDraggingSticker] = useState(false);

    // Hit detection to manage z-index interaction between stickers (canvas) and DOM overlays
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!stageRef.current) return;

            // Convert viewport coordinates to stage-relative coordinates
            const container = stageRef.current.container();
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Only check intersection if mouse is within stage bounds
            if (x < 0 || y < 0 || x > layout.width || y > layout.height) {
                setIsHoveringSticker(false);
                return;
            }

            const shape = stageRef.current.getIntersection({ x, y });

            if (shape && shape.name() === 'sticker') {
                setIsHoveringSticker(true);
            } else if (shape && shape.getParent()?.getClassName() === 'Transformer') {
                setIsHoveringSticker(true);
            } else {
                setIsHoveringSticker(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [layout.width, layout.height]);

    // Recalculate layout on mount and resize
    useEffect(() => {
        const updateLayout = () => {
            if (containerRef.current) {
                // Round down to avoid sub-pixel rendering issues (the "hair line" glitch)
                const width = Math.floor(containerRef.current.offsetWidth);

                // On mobile, calculate available height as viewport minus dock
                const isMobile = window.innerWidth < 768;
                const dockHeight = isMobile ? 200 : 0; // Dock + safe area padding
                const viewportHeight = window.innerHeight;
                const availableHeight = Math.floor(isMobile ? viewportHeight - dockHeight : containerRef.current.offsetHeight);

                if (isStrip) {
                    // Reference dimensions from Booth.jsx to ensure WYSIWYG proportions
                    // Booth uses w-28 (112px) for photos
                    // border-4 (4px) for outer border
                    // padding: var(--strip-padding)
                    // gap: var(--strip-padding)

                    const calculated = calculateStripLayout(width, availableHeight, capturedImages.length);
                    // Floor all dimensions to prevent sub-pixel hairline artifacts
                    setLayout({
                        ...calculated,
                        width: Math.floor(calculated.width),
                        height: Math.floor(calculated.height),
                        photoSize: Math.floor(calculated.photoSize)
                    });

                } else {
                    // Single square photo logic
                    const PAD = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--strip-padding')) || 20;
                    const size = Math.min(width, height) - (2 * PAD);
                    setLayout({
                        width: size,
                        height: size,
                        photoSize: size,
                        pad: 0,
                        border: 0,
                        gap: 0
                    });
                }
            }
        };

        // Initial layout calculation
        updateLayout();

        // Recalculate on window resize
        window.addEventListener('resize', updateLayout);
        return () => window.removeEventListener('resize', updateLayout);
    }, [capturedImages, isStrip]);

    // Attach transformer to selected node
    useEffect(() => {
        if (selectedId && transformerRef.current && stickersRefs.current[selectedId]) {
            const node = stickersRefs.current[selectedId];
            transformerRef.current.nodes([node]);
            transformerRef.current.getLayer().batchDraw();
        } else if (transformerRef.current) {
            transformerRef.current.nodes([]);
            transformerRef.current.getLayer().batchDraw();
        }
    }, [selectedId, stickers]); // Re-run if stickers change (e.g. re-order or delete)

    // Push current stickers to history (avoid when applying history)
    const pushHistory = (state) => {
        if (isApplyingHistoryRef.current) return;
        const snap = JSON.stringify(state);
        const stack = historyRef.current.stack;
        const idx = historyRef.current.index;

        // Avoid duplicate consecutive snapshots
        if (stack.length > 0 && stack[idx] === snap) return;

        // Trim any redo states
        stack.splice(idx + 1);
        stack.push(snap);
        if (stack.length > MAX_HISTORY) {
            stack.shift();
        }
        historyRef.current.index = stack.length - 1;
    };

    useEffect(() => {
        pushHistory(stickers);
    }, [stickers]);

    const undo = () => {
        const idx = historyRef.current.index;
        if (idx > 0) {
            isApplyingHistoryRef.current = true;
            const prev = JSON.parse(historyRef.current.stack[idx - 1]);
            historyRef.current.index = idx - 1;
            selectShape(null);
            setStickers(prev);
            // Allow React to finish applying
            setTimeout(() => (isApplyingHistoryRef.current = false), 0);
        }
    };

    const redo = () => {
        const idx = historyRef.current.index;
        if (idx < historyRef.current.stack.length - 1) {
            isApplyingHistoryRef.current = true;
            const next = JSON.parse(historyRef.current.stack[idx + 1]);
            historyRef.current.index = idx + 1;
            selectShape(null);
            setStickers(next);
            setTimeout(() => (isApplyingHistoryRef.current = false), 0);
        }
    };

    // Keyboard handlers for undo/redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z or Cmd/Ctrl+Y)
    useEffect(() => {
        const onKeyDown = (e) => {
            const meta = e.metaKey || e.ctrlKey;
            if (!meta) return;

            // Undo: Cmd/Ctrl + Z (without shift)
            if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Cmd/Ctrl + Shift + Z OR Cmd/Ctrl + Y
            if (((e.key === 'z' || e.key === 'Z') && e.shiftKey) || e.key === 'y' || e.key === 'Y') {
                e.preventDefault();
                redo();
                return;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    const checkDeselect = (e) => {
        const target = e.target;
        const stage = target.getStage();

        // If clicked directly on stage (empty space) -> deselect
        if (target === stage) {
            selectShape(null);
            return;
        }

        // Walk up the node ancestry to see if the click happened on a sticker
        let node = target;
        while (node && node !== stage) {
            // If the clicked node is one of our sticker nodes, don't deselect
            if (Object.values(stickersRefs.current).includes(node)) {
                return;
            }

            // If clicking on the transformer itself, don't deselect
            if (transformerRef.current && node === transformerRef.current) {
                return;
            }

            node = node.getParent();
        }

        // Otherwise, deselect
        selectShape(null);
    };

    // Clear selection when clicking outside the stage (e.g., sidebar or other UI)
    useEffect(() => {
        const handleDocDown = (e) => {
            if (!stageRef.current) return;
            const container = stageRef.current.container();
            if (!container.contains(e.target)) {
                selectShape(null);
            }
        };

        document.addEventListener('mousedown', handleDocDown);
        document.addEventListener('touchstart', handleDocDown);
        return () => {
            document.removeEventListener('mousedown', handleDocDown);
            document.removeEventListener('touchstart', handleDocDown);
        };
    }, []);

    const addSticker = (src, x, y) => {
        const id = `sticker-${Date.now()}`;
        const size = layout.width * 0.2;

        // Calculate position to center the sticker
        // If x,y provided (drop), use them as center. If not (click), use stage center.
        const centerX = x !== undefined ? x : layout.width / 2;
        const centerY = y !== undefined ? y : layout.height / 2;

        setStickers([
            ...stickers,
            {
                id,
                src,
                x: centerX - size / 2,
                y: centerY - size / 2,
                width: size,
                height: size,
                rotation: 0,
            }
        ]);
        selectShape(id);
    };

    const handleDownload = () => {
        selectShape(null);
        setTimeout(() => {
            const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = isStrip ? 'boothy-strip.png' : 'boothy-creation.png';
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }, 100);
    };

    // Drag and Drop Logic
    const handleDragStart = (e, src) => {
        e.dataTransfer.setData('stickerSrc', src);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        stageRef.current.setPointersPositions(e);
        const pointerPosition = stageRef.current.getPointerPosition();

        const src = e.dataTransfer.getData('stickerSrc');
        if (src && pointerPosition) {
            addSticker(src, pointerPosition.x, pointerPosition.y);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    // Use centralized stickers
    const stickerList = getStickers();

    // Handle clicking on a photo in the strip to edit its Live Photo
    const handlePhotoClick = (photoIndex) => {
        if (hasLivePhotos && livePhotoFrames[photoIndex]) {
            setCurrentlyEditingPhotoIndex(photoIndex);
        }
    };

    // Close the Live Photo editor
    const handleCloseEditor = () => {
        setCurrentlyEditingPhotoIndex(null);
    };

    return (
        <div className="h-screen max-h-screen md:h-full md:max-h-full w-full bg-gray-100 flex flex-col md:flex-row overflow-hidden">

            {/* Main Canvas Area - takes remaining space after bottom controls on mobile */}
            <Motion.div
                className="flex-1 min-h-0 relative flex items-start md:items-center justify-center overflow-hidden pb-[180px] md:pb-0"
                style={{ padding: 'var(--strip-padding)', paddingBottom: 'calc(var(--strip-padding) + 160px)' }}
                ref={containerRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                animate={{
                    x: isEditing ? -200 : 0,
                    opacity: isEditing ? 0.3 : 1
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="shadow-2xl border-4 border-white bg-white relative z-200">
                    <Stage
                        width={layout.width}
                        height={layout.height}
                        onMouseDown={checkDeselect}
                        onTouchStart={checkDeselect}
                        ref={stageRef}
                    >
                        <Layer>
                            <Rect width={layout.width} height={layout.height} fill="white" listening={false} />
                            {/* Background Photo(s) */}
                            {!isStrip && capturedImage && (
                                <URLImage
                                    src={capturedImage}
                                    name="background"
                                    isBackground={true}
                                    x={capturedImageIsMirrored ? layout.width : 0}
                                    scaleX={capturedImageIsMirrored ? -1 : 1}
                                    y={0}
                                    width={layout.width}
                                    height={layout.height}
                                />
                            )}

                            {isStrip && capturedImages.map((src, i) => {
                                const { photoSize, pad, border, gap } = layout;
                                const yPos = border + pad + i * (photoSize + gap);
                                const xPos = border + pad;

                                return (
                                    <URLImage
                                        key={i}
                                        src={src}
                                        name="background"
                                        isBackground={true}
                                        x={capturedImageIsMirrored ? (xPos + photoSize) : xPos}
                                        scaleX={capturedImageIsMirrored ? -1 : 1}
                                        y={yPos}
                                        width={photoSize}
                                        height={photoSize}
                                    />
                                );
                            })}

                            {/* Stickers */}
                            {stickers.map((sticker, i) => (
                                <URLImage
                                    key={sticker.id}
                                    name="sticker"
                                    {...sticker}
                                    shapeRef={(node) => {
                                        stickersRefs.current[sticker.id] = node;
                                    }}
                                    isSelected={sticker.id === selectedId}
                                    onSelect={() => selectShape(sticker.id)}
                                    onDragStart={() => setIsDraggingSticker(true)}
                                    onDragEnd={(newAttrs) => {
                                        setIsDraggingSticker(false);
                                        const slice = stickers.slice();
                                        slice[i] = newAttrs;
                                        setStickers(slice);
                                    }}
                                    onChange={(newAttrs) => {
                                        const slice = stickers.slice();
                                        slice[i] = newAttrs;
                                        setStickers(slice);
                                    }}
                                />
                            ))}

                            {/* Global Transformer */}
                            <Transformer
                                ref={transformerRef}
                                boundBoxFunc={(oldBox, newBox) => {
                                    if (newBox.width < 5 || newBox.height < 5) {
                                        return oldBox;
                                    }
                                    return newBox;
                                }}
                            />
                        </Layer>
                    </Stage>

                    {/* Clickable photo overlays for Live Photo editing (strip mode only) */}
                    {isStrip && hasLivePhotos && !isEditing && (
                        <div className="absolute inset-0 pointer-events-none">
                            {capturedImages.map((_, i) => {
                                const { photoSize, pad, border, gap } = layout;
                                const yPos = border + pad + i * (photoSize + gap);
                                const xPos = border + pad;
                                const hasFrames = livePhotoFrames[i] && livePhotoFrames[i].length > 0;

                                return hasFrames ? (
                                    <Motion.button
                                        key={`edit-${i}`}
                                        className={`absolute transition-all duration-200 cursor-pointer group ${(isHoveringSticker || isDraggingSticker) ? 'pointer-events-none opacity-0' : 'pointer-events-auto bg-transparent hover:bg-black/10 opacity-100'}`}
                                        style={{
                                            left: xPos,
                                            top: yPos,
                                            width: photoSize,
                                            height: photoSize
                                        }}
                                        onClick={() => handlePhotoClick(i)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {/* Live Photo indicator */}
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded-full text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                                            LIVE
                                        </div>
                                        {/* Edit hint */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="px-4 py-2 bg-black/70 rounded-xl text-white font-bold">
                                                Choose Best Frame
                                            </div>
                                        </div>
                                    </Motion.button>
                                ) : null;
                            })}
                        </div>
                    )}
                </div>
            </Motion.div>

            {/* Sidebar / Controls - Desktop */}
            <Motion.div
                className="hidden md:flex w-80 bg-white border-l border-gray-200 flex-col shrink-0 z-10"
                animate={{
                    x: isEditing ? 100 : 0,
                    opacity: isEditing ? 0.3 : 1
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-2xl font-black text-cute-pink">Studio</h2>
                    <p className="text-gray-500 text-sm">Drag stickers onto the photo!</p>
                    {hasLivePhotos && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                            Click photos to edit Live frames
                        </div>
                    )}
                </div>

                {/* Sticker Grid - Desktop */}
                <div className="flex-1 overflow-y-scroll p-4 grid grid-cols-3 gap-4 content-start">
                    {stickerList.map((src, i) => (
                        <Motion.div
                            key={i}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="aspect-square bg-gray-50 rounded-xl p-2 hover:bg-pink-50 transition-colors cursor-grab active:cursor-grabbing"
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, src)}
                            onClick={() => addSticker(src)}
                        >
                            <img src={src} alt="Sticker" className="w-full h-full object-contain pointer-events-none" />
                        </Motion.div>
                    ))}
                </div>

                {/* Actions - Desktop */}
                <div className="p-6 border-t border-gray-100 flex flex-col gap-3">
                    <button
                        onClick={() => setCapturedImageIsMirrored(!capturedImageIsMirrored)}
                        className={`w-full py-3 font-bold rounded-xl transition-colors ${capturedImageIsMirrored
                            ? 'bg-cute-pink text-white hover:bg-pink-400'
                            : 'bg-white border-2 border-cute-pink text-cute-pink hover:bg-pink-50'
                            }`}
                    >
                        {capturedImageIsMirrored ? '✓ Flipped' : 'Flip Image'}
                    </button>
                    <button
                        onClick={handleDownload}
                        className="w-full py-3 bg-cute-pink text-white font-bold rounded-xl shadow-lg hover:bg-pink-400 transition-colors"
                    >
                        Download Image
                    </button>
                    <button
                        onClick={() => { setIsRetakeSelecting(true); setPhase('BOOTH'); }}
                        className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Retake Photo
                    </button>
                </div>
            </Motion.div>

            <Motion.div
                className="flex md:hidden flex-col items-center justify-end fixed bottom-0 left-0 right-0 z-[1000] pointer-events-none pb-[calc(env(safe-area-inset-bottom)+5px)]"
                initial={{ y: 200 }}
                animate={{
                    y: isEditing ? 200 : 0,
                    opacity: isEditing ? 0 : 1
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {/* Glassmorphism Container */}
                <div className="w-[95%] max-w-sm mb-2 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl overflow-hidden pointer-events-auto ring-1 ring-black/5">

                    {/* Sticker Scroll */}
                    <div className="flex overflow-x-auto gap-4 p-4 scrollbar-hide snap-x">
                        {stickerList.map((src, i) => (
                            <Motion.div
                                key={i}
                                whileTap={{ scale: 0.85 }}
                                className="w-16 h-16 shrink-0 bg-white/60 rounded-2xl p-2 shadow-sm snap-center border border-white/50 active:bg-pink-100 transition-colors"
                                onClick={() => {
                                    if (typeof navigator.vibrate === 'function') navigator.vibrate(5);
                                    addSticker(src);
                                }}
                            >
                                <img src={src} alt="Sticker" className="w-full h-full object-contain pointer-events-none select-none" />
                            </Motion.div>
                        ))}
                    </div>

                    {/* Separator */}
                    <div className="h-px w-full bg-linear-to-r from-transparent via-gray-200 to-transparent" />

                    {/* Action Buttons */}
                    <div className="flex p-3 gap-3">
                        <Motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                if (typeof navigator.vibrate === 'function') navigator.vibrate(10);
                                setCapturedImageIsMirrored(!capturedImageIsMirrored);
                            }}
                            className={`flex-1 py-4 font-bold rounded-2xl text-sm transition-all shadow-sm ${capturedImageIsMirrored
                                ? 'bg-cute-pink text-white shadow-pink-200'
                                : 'bg-white text-cute-pink border border-pink-100'
                                }`}
                        >
                            {capturedImageIsMirrored ? '✓ Flipped' : 'Flip'}
                        </Motion.button>

                        <Motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                if (typeof navigator.vibrate === 'function') navigator.vibrate(10);
                                handleDownload();
                            }}
                            className="flex-1 py-4 bg-gray-900/90 text-white font-bold rounded-2xl shadow-lg shadow-gray-200 text-sm backdrop-blur-sm"
                        >
                            Save
                        </Motion.button>

                        <Motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                if (typeof navigator.vibrate === 'function') navigator.vibrate(10);
                                setIsRetakeSelecting(true);
                                setPhase('BOOTH');
                            }}
                            className="w-14 flex items-center justify-center bg-gray-100 text-gray-500 font-bold rounded-2xl shadow-inner hover:bg-gray-200"
                        >
                            <span className="text-xl">↺</span>
                        </Motion.button>
                    </div>
                </div>
            </Motion.div>

            {/* Live Photo Editor Modal */}
            <AnimatePresence>
                {isEditing && (
                    <LivePhotoEditor
                        photoIndex={currentlyEditingPhotoIndex}
                        onClose={handleCloseEditor}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Studio;

import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Transformer, Rect } from 'react-konva';
import { useStore } from '../store';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import URLImage from './URLImage';
import { getStickers } from '../data/stickers';
import { calculateStripLayout } from '../utils/stripLayout';
import LivePhotoEditor from './LivePhotoEditor';
import TrashZone from './TrashZone';

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

    // Mobile detection for trash zones
    const [isMobile, setIsMobile] = useState(false);

    // Trash zone refs and state for mobile drag-to-delete
    const leftTrashRef = useRef(null);
    const rightTrashRef = useRef(null);
    const [activeTrashZone, setActiveTrashZone] = useState(null); // 'left' | 'right' | null
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const draggingStickerId = useRef(null);

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

    // Mobile detection
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Check if drag position is over trash zones
    const checkTrashZoneHit = (viewportX, viewportY) => {
        if (!isMobile) return null;

        const leftZone = leftTrashRef.current;
        const rightZone = rightTrashRef.current;

        if (leftZone) {
            const rect = leftZone.getBoundingClientRect();
            if (viewportX >= rect.left && viewportX <= rect.right &&
                viewportY >= rect.top && viewportY <= rect.bottom) {
                return 'left';
            }
        }

        if (rightZone) {
            const rect = rightZone.getBoundingClientRect();
            if (viewportX >= rect.left && viewportX <= rect.right &&
                viewportY >= rect.top && viewportY <= rect.bottom) {
                return 'right';
            }
        }

        return null;
    };

    // Handle sticker drag move - check for trash zone hits
    const handleStickerDragMove = (stickerId, position) => {
        if (!isMobile) return;

        setDragPosition({ x: position.viewportX, y: position.viewportY });
        const hitZone = checkTrashZoneHit(position.viewportX, position.viewportY);
        setActiveTrashZone(hitZone);
    };

    // Delete sticker by id
    const deleteSticker = (id) => {
        setStickers(prev => prev.filter(s => s.id !== id));
        selectShape(null);
    };

    // Recalculate layout on mount and resize
    useEffect(() => {
        const updateLayout = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                const height = containerRef.current.offsetHeight;

                if (isStrip) {
                    // Reference dimensions from Booth.jsx to ensure WYSIWYG proportions
                    // Booth uses w-28 (112px) for photos
                    // border-4 (4px) for outer border
                    // padding: var(--strip-padding)
                    // gap: var(--strip-padding)

                    const calculated = calculateStripLayout(width, height, capturedImages.length);
                    setLayout(calculated);

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
                className="flex-1 min-h-0 relative bg-checkered flex items-center justify-center overflow-hidden"
                style={{ padding: 'var(--strip-padding)' }}
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
                                    onDragStart={() => {
                                        setIsDraggingSticker(true);
                                        draggingStickerId.current = sticker.id;
                                    }}
                                    onDragMove={(position) => {
                                        handleStickerDragMove(sticker.id, position);
                                    }}
                                    onDragEnd={(newAttrs) => {
                                        setIsDraggingSticker(false);

                                        // Check if dropped on trash zone
                                        if (isMobile && activeTrashZone) {
                                            deleteSticker(sticker.id);
                                            setActiveTrashZone(null);
                                            draggingStickerId.current = null;
                                            return;
                                        }

                                        // Normal drop - update position
                                        const slice = stickers.slice();
                                        slice[i] = newAttrs;
                                        setStickers(slice);
                                        setActiveTrashZone(null);
                                        draggingStickerId.current = null;
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

            {/* Mobile Bottom Bar with Stickers + Actions */}
            <Motion.div
                className="flex md:hidden flex-col bg-white border-t border-gray-200 shrink-0 z-10 pb-16 md:pb-0"
                animate={{
                    y: isEditing ? 100 : 0,
                    opacity: isEditing ? 0.3 : 1
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {/* Horizontal Sticker Scroll */}
                <div className="flex overflow-x-auto gap-3 p-3 border-b border-gray-100">
                    {stickerList.map((src, i) => (
                        <Motion.div
                            key={i}
                            whileTap={{ scale: 0.9 }}
                            className="w-14 h-14 shrink-0 bg-gray-50 rounded-xl p-1.5 active:bg-pink-50 transition-colors"
                            onClick={() => addSticker(src)}
                        >
                            <img src={src} alt="Sticker" className="w-full h-full object-contain" />
                        </Motion.div>
                    ))}
                </div>

                {/* Mobile Action Buttons - Compact Row */}
                <div className="flex gap-2 p-3">
                    <button
                        onClick={() => setCapturedImageIsMirrored(!capturedImageIsMirrored)}
                        className={`flex-1 py-3 font-bold rounded-xl transition-colors text-sm min-h-[48px] ${capturedImageIsMirrored
                            ? 'bg-cute-pink text-white'
                            : 'bg-white border-2 border-cute-pink text-cute-pink'
                            }`}
                    >
                        {capturedImageIsMirrored ? '✓ Flip' : 'Flip'}
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex-1 py-3 bg-cute-pink text-white font-bold rounded-xl shadow-lg text-sm min-h-[48px]"
                    >
                        Download
                    </button>
                    <button
                        onClick={() => { setIsRetakeSelecting(true); setPhase('BOOTH'); }}
                        className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl text-sm min-h-[48px]"
                    >
                        Retake
                    </button>
                </div>
            </Motion.div>

            {/* Mobile Trash Zones - appear when dragging stickers */}
            {isMobile && (
                <>
                    <TrashZone
                        side="left"
                        isVisible={isDraggingSticker}
                        isActive={activeTrashZone === 'left'}
                        zoneRef={leftTrashRef}
                    />
                    <TrashZone
                        side="right"
                        isVisible={isDraggingSticker}
                        isActive={activeTrashZone === 'right'}
                        zoneRef={rightTrashRef}
                    />
                </>
            )}

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

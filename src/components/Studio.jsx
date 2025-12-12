import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Transformer, Rect } from 'react-konva';
import { useStore } from '../store';
import { motion as Motion } from 'framer-motion';
import URLImage from './URLImage';
import { getStickers } from '../data/stickers';

const Studio = () => {
    const { capturedImage, setPhase, capturedImageIsMirrored, setCapturedImageIsMirrored, originalCapturedImageIsMirrored, capturedImages } = useStore();
    const stageRef = useRef(null);
    const [stickers, setStickers] = useState([]);
    const [selectedId, selectShape] = useState(null);
    const transformerRef = useRef(null);

    // We need refs for all stickers to attach transformer
    const stickersRefs = useRef({});

    const [layout, setLayout] = useState({ width: 800, height: 800, photoSize: 0, pad: 0, gap: 0, border: 0 });
    const containerRef = useRef(null);

    // Check if we are in strip mode
    const isStrip = capturedImages && capturedImages.length > 1;

    useEffect(() => {
        if (containerRef.current) {
            const width = containerRef.current.offsetWidth;
            const height = containerRef.current.offsetHeight;

            if (isStrip) {
                // Reference dimensions from Booth.jsx to ensure WYSIWYG proportions
                // Booth uses w-28 (112px) for photos
                // border-4 (4px) for outer border
                // padding: var(--strip-padding)
                // gap: var(--strip-padding)
                
                const REF_PHOTO_SIZE = 112;
                const REF_BORDER = 4;
                const PAD = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--strip-padding')) || 20;
                
                // Total Reference Dimensions
                const refW = REF_PHOTO_SIZE + (2 * PAD) + (2 * REF_BORDER);
                const count = capturedImages.length;
                const refH = (REF_PHOTO_SIZE * count) + ((count - 1) * PAD) + (2 * PAD) + (2 * REF_BORDER);

                // Calculate Scale to fit container
                const scaleX = width / refW;
                const scaleY = height / refH;
                const scale = Math.min(scaleX, scaleY) * 0.95; // 0.95 to leave a small margin

                setLayout({
                    width: refW * scale,
                    height: refH * scale,
                    photoSize: REF_PHOTO_SIZE * scale,
                    pad: PAD * scale,
                    border: REF_BORDER * scale,
                    gap: PAD * scale
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

    const checkDeselect = (e) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            selectShape(null);
        }
    };

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

    return (
        <div className="h-full w-full bg-gray-100 flex flex-col md:flex-row overflow-y-auto">

            {/* Main Canvas Area */}
            <div
                className="flex-1 relative bg-checkered flex items-center justify-center"
                style={{ padding: 'var(--strip-padding)' }}
                ref={containerRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <div className="shadow-2xl border-4 border-white bg-white">
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
                                    isBackground={true}
                                    x={(capturedImageIsMirrored !== originalCapturedImageIsMirrored) ? layout.width : 0}
                                    scaleX={(capturedImageIsMirrored !== originalCapturedImageIsMirrored) ? -1 : 1}
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
                                        isBackground={true}
                                        x={(capturedImageIsMirrored !== originalCapturedImageIsMirrored) ? (xPos + photoSize) : xPos}
                                        scaleX={(capturedImageIsMirrored !== originalCapturedImageIsMirrored) ? -1 : 1}
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
                                    {...sticker}
                                    shapeRef={(node) => {
                                        stickersRefs.current[sticker.id] = node;
                                    }}
                                    isSelected={sticker.id === selectedId}
                                    onSelect={() => selectShape(sticker.id)}
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
                </div>
            </div>

            {/* Sidebar / Controls */}
            <div className="w-full md:w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 z-10">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-2xl font-black text-cute-pink">Studio</h2>
                    <p className="text-gray-500 text-sm">Drag stickers onto the photo!</p>
                    {capturedImageIsMirrored && (
                        <div className="text-xs text-right text-gray-400 mt-1">Mirrored image</div>
                    )}
                </div>

                {/* Sticker Grid */}
                <div className="flex-1 overflow-y-scroll p-4 grid grid-cols-3 gap-4 content-start">
                    {stickerList.map((src, i) => (
                        <Motion.div
                            key={i}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="aspect-square bg-gray-50 rounded-xl p-2 hover:bg-pink-50 transition-colors cursor-grab active:cursor-grabbing"
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, src)}
                            onClick={() => addSticker(src)} // Keep click to add as well
                        >
                            <img src={src} alt="Sticker" className="w-full h-full object-contain pointer-events-none" />
                        </Motion.div>
                    ))}
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-100 flex flex-col gap-3">
                    <button
                        onClick={() => setCapturedImageIsMirrored(!capturedImageIsMirrored)}
                        className="w-full py-3 bg-white border-2 border-cute-pink text-cute-pink font-bold rounded-xl hover:bg-pink-50 transition-colors"
                    >
                        Flip Image
                    </button>
                    <button
                        onClick={handleDownload}
                        className="w-full py-3 bg-cute-pink text-white font-bold rounded-xl shadow-lg hover:bg-pink-400 transition-colors"
                    >
                        Download Image
                    </button>
                    <button
                        onClick={() => setPhase('BOOTH')}
                        className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Retake Photo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Studio;


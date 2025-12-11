import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import { useStore } from '../store';
import { motion as Motion } from 'framer-motion';
import URLImage from './URLImage';
import { getStickers } from '../data/stickers';

const Studio = () => {
    const { capturedImage, setPhase, capturedImageIsMirrored } = useStore();
    const stageRef = useRef(null);
    const [stickers, setStickers] = useState([]);
    const [selectedId, selectShape] = useState(null);
    const transformerRef = useRef(null);

    // We need refs for all stickers to attach transformer
    const stickersRefs = useRef({});

    const [stageSize, setStageSize] = useState({ width: 800, height: 800 });
    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current) {
            const width = containerRef.current.offsetWidth;
            const height = containerRef.current.offsetHeight;
            const size = Math.min(width, height) - 40; // Padding
            setStageSize({
                width: size,
                height: size
            });
        }
    }, []);

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
        const size = stageSize.width * 0.2;

        // Calculate position to center the sticker
        // If x,y provided (drop), use them as center. If not (click), use stage center.
        const centerX = x !== undefined ? x : stageSize.width / 2;
        const centerY = y !== undefined ? y : stageSize.height / 2;

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
            link.download = 'boothy-creation.png';
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
                className="flex-1 relative bg-checkered flex items-center justify-center p-4"
                ref={containerRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <Motion.div
                    initial={{ scale: 0.2, rotate: -5, x: 0, opacity: 1 }}
                    animate={{ scale: 1, rotate: 0, x: 0, opacity: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                        delay: 0.1
                    }}
                    className="shadow-2xl border-4 border-white bg-white"
                >
                    <Stage
                        width={stageSize.width}
                        height={stageSize.height}
                        onMouseDown={checkDeselect}
                        onTouchStart={checkDeselect}
                        ref={stageRef}
                    >
                        <Layer>
                            {/* Background Photo */}
                            {capturedImage && (
                                <URLImage
                                    src={capturedImage}
                                    isBackground={true}
                                    x={0}
                                    y={0}
                                    width={stageSize.width}
                                    height={stageSize.height}
                                />
                            )}

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
                </Motion.div>
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


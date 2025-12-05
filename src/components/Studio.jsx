import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { useStore } from '../store';
import { motion } from 'framer-motion';

// URLImage component for loading images on canvas
// Now simplified: it doesn't handle Transformer internally
const URLImage = ({ src, isBackground = false, onSelect, onChange, shapeRef, ...props }) => {
    const [image] = useImage(src, 'anonymous');

    // If it's the background, we want it to fill the stage or fit nicely
    let crop = undefined;
    if (isBackground && image) {
        // Calculate crop to cover the square area centrally
        const imageAspect = image.width / image.height;
        const stageAspect = props.width / props.height; // Should be 1 for square

        if (imageAspect > stageAspect) {
            // Image is wider than stage -> crop width
            const newWidth = image.height * stageAspect;
            const offsetX = (image.width - newWidth) / 2;
            crop = {
                x: offsetX,
                y: 0,
                width: newWidth,
                height: image.height
            };
        } else {
            // Image is taller than stage -> crop height
            const newHeight = image.width / stageAspect;
            const offsetY = (image.height - newHeight) / 2;
            crop = {
                x: 0,
                y: offsetY,
                width: image.width,
                height: newHeight
            };
        }
    }

    return (
        <KonvaImage
            image={image}
            ref={shapeRef}
            crop={crop}
            {...props}
            draggable={!isBackground}
            onClick={onSelect}
            onTap={onSelect}
            onDragEnd={(e) => {
                if (!isBackground && onChange) {
                    onChange({
                        ...props,
                        src, // Critical: Add src back because it was destructured
                        x: e.target.x(),
                        y: e.target.y(),
                    });
                }
            }}
            onTransformEnd={(e) => {
                if (!isBackground && onChange) {
                    const node = e.target; // Use e.target instead of ref
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    // reset it back to 1
                    node.scaleX(1);
                    node.scaleY(1);

                    onChange({
                        ...props,
                        src, // Critical: Add src back
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(5, node.width() * scaleX),
                        height: Math.max(5, node.height() * scaleY),
                        rotation: node.rotation(),
                    });
                }
            }}
        />
    );
};

const Studio = () => {
    const { capturedImage, setPhase } = useStore();
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

    const stickerList = Array.from({ length: 16 }, (_, i) => `/stickers/Artboard ${i + 1}.webp`);

    return (
        <div className="h-full w-full bg-gray-100 flex flex-col md:flex-row overflow-hidden">

            {/* Main Canvas Area */}
            <div
                className="flex-1 relative bg-checkered flex items-center justify-center p-4"
                ref={containerRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <div className="shadow-2xl border-4 border-white bg-white">
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
                </div>
            </div>

            {/* Sidebar / Controls */}
            <div className="w-full md:w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 z-10">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-2xl font-black text-cute-pink">Studio</h2>
                    <p className="text-gray-500 text-sm">Drag stickers onto the photo!</p>
                </div>

                {/* Sticker Grid */}
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-4 content-start">
                    {stickerList.map((src, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="aspect-square bg-gray-50 rounded-xl p-2 hover:bg-pink-50 transition-colors cursor-grab active:cursor-grabbing"
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, src)}
                            onClick={() => addSticker(src)} // Keep click to add as well
                        >
                            <img src={src} alt="Sticker" className="w-full h-full object-contain pointer-events-none" />
                        </motion.div>
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

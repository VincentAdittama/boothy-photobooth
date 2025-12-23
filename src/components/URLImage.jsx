import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';

const getViewportPointFromEvent = (evt) => {
    if (!evt) return null;

    if (typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
        return { x: evt.clientX, y: evt.clientY };
    }

    const touch = (evt.touches && evt.touches[0]) || (evt.changedTouches && evt.changedTouches[0]);
    if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
        return { x: touch.clientX, y: touch.clientY };
    }

    return null;
};

// URLImage component for loading images on canvas
const URLImage = ({ src, isBackground = false, onSelect, onChange, onDragStart, onDragMove, onDragEnd, shapeRef, ...props }) => {
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
            scaleX={props.scaleX || 1}
            x={props.x}
            draggable={!isBackground}
            onClick={onSelect}
            onTap={onSelect}
            onDragStart={() => {
                if (!isBackground && onDragStart) {
                    onDragStart();
                }
            }}
            onDragMove={(e) => {
                if (!isBackground && onDragMove) {
                    // Get viewport position for hit detection outside canvas.
                    // On mobile Safari, Konva can momentarily report a null pointer position while dragging,
                    // which would otherwise crash the app.
                    const viewportPoint = getViewportPointFromEvent(e?.evt);

                    const stage = e?.target?.getStage?.();
                    const pointerPos = stage?.getPointerPosition?.() || null;

                    if (viewportPoint) {
                        onDragMove({
                            viewportX: viewportPoint.x,
                            viewportY: viewportPoint.y,
                            stageX: pointerPos ? pointerPos.x : undefined,
                            stageY: pointerPos ? pointerPos.y : undefined,
                        });
                        return;
                    }

                    if (!stage || !pointerPos) return;
                    const container = stage.container && stage.container();
                    if (!container || !container.getBoundingClientRect) return;
                    const rect = container.getBoundingClientRect();

                    onDragMove({
                        viewportX: rect.left + pointerPos.x,
                        viewportY: rect.top + pointerPos.y,
                        stageX: pointerPos.x,
                        stageY: pointerPos.y,
                    });
                }
            }}
            onDragEnd={(e) => {
                if (!isBackground) {
                    const newAttrs = {
                        ...props,
                        src,
                        x: e.target.x(),
                        y: e.target.y(),
                    };
                    if (onDragEnd) {
                        onDragEnd(newAttrs);
                    } else if (onChange) {
                        onChange(newAttrs);
                    }
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

export default URLImage;

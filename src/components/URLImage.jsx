import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';

// URLImage component for loading images on canvas
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
            scaleX={props.scaleX || 1}
            x={props.x}
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

export default URLImage;

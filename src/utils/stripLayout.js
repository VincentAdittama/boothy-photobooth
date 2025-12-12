export const calculateStripLayout = (containerWidth, containerHeight, numImages) => {
    // Reference dimensions from Booth.jsx designed to match
    // Booth uses w-28 (112px) for photos
    // border-4 (4px) for outer border
    // padding: var(--strip-padding) (defaulting to 20px if not found)
    // gap: var(--strip-padding)

    // Get padding from CSS variable if in browser environment, else default
    let PAD = 20;
    if (typeof window !== 'undefined') {
        const docPad = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--strip-padding'));
        if (!isNaN(docPad)) PAD = docPad;
    }

    const REF_PHOTO_SIZE = 112;
    const REF_BORDER = 4;

    // Total Reference Dimensions (Unscaled)
    const refW = REF_PHOTO_SIZE + (2 * PAD) + (2 * REF_BORDER);
    // Height = (photos * size) + (gaps) + (top/bottom pad) + (borders)
    const refH = (REF_PHOTO_SIZE * numImages) + ((numImages - 1) * PAD) + (2 * PAD) + (2 * REF_BORDER);

    // Calculate Scale to fit container
    // We add a safety margin (0.95) to ensure it fits comfortably
    const scaleX = containerWidth / refW;
    const scaleY = containerHeight / refH;
    const scale = Math.min(scaleX, scaleY) * 0.95;

    return {
        width: refW * scale,
        height: refH * scale,
        photoSize: REF_PHOTO_SIZE * scale,
        pad: PAD * scale,
        border: REF_BORDER * scale,
        gap: PAD * scale,
        scale // useful for debugging or other scaling needs
    };
};

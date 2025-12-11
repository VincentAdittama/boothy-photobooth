export const getStickers = () => {
    // Generate the list of 16 stickers based on the naming convention
    return Array.from({ length: 16 }, (_, i) => `/stickers/Artboard ${i + 1}.webp`);
};

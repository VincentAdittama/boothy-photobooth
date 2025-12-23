// Small helper for DEV-only mock data so Studio can exercise the Live Photo editor
// without requiring camera access.

export const MOCK_STRIP_IMAGES = [
  '/assets/Asset%2017.webp',
  '/assets/Asset%2018.webp',
  '/assets/hello.webp',
];

export const createMockLivePhotoFrames = (
  images = MOCK_STRIP_IMAGES,
  { totalFrames = 48, snapIndex = 24 } = {}
) => {
  return images.map((snapSrc, photoIndex) => {
    const altA = images[(photoIndex + 1) % images.length];
    const altB = images[(photoIndex + 2) % images.length];

    return Array.from({ length: totalFrames }, (_, frameIndex) => {
      if (frameIndex === snapIndex) return snapSrc;

      const alt = frameIndex < snapIndex ? altA : altB;
      const useAlt = Math.floor(frameIndex / 3) % 2 === 1;
      const chosen = useAlt ? alt : snapSrc;

      // Unique query param keeps the URL distinct per frame.
      return `${chosen}?mockFrame=${photoIndex}-${frameIndex}`;
    });
  });
};

export const getMockStripSeed = () => {
  const images = [...MOCK_STRIP_IMAGES];
  return {
    images,
    capturedImage: images[0],
    livePhotoFrames: createMockLivePhotoFrames(images),
    // Mirror the preview like a selfie camera so Studio feels “real”.
    capturedImageIsMirrored: true,
  };
};

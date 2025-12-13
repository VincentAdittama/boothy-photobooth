import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';

const CurtainTransition = () => {
    const isCurtainOpen = useStore((state) => state.isCurtainOpen);

    const transition = {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1], // Custom easing for smooth curtain feel
    };

    return (
        <div className="fixed inset-0 pointer-events-none z-100 flex">
            {/* Left Curtain */}
            <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: isCurtainOpen ? '-100%' : '0%' }}
                transition={transition}
                className="w-1/2 h-full bg-[#E63946] border-r-4 border-[#333]/20 relative"
            >
                {/* Fabric Texture/Fold gradients */}
                <div className="absolute inset-0 bg-linear-to-r from-black/20 via-transparent to-black/20 opacity-50" />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(0,0,0,0.1)_50px,transparent_60px)] opacity-30" />
            </motion.div>

            {/* Right Curtain */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: isCurtainOpen ? '100%' : '0%' }}
                transition={transition}
                className="w-1/2 h-full bg-[#E63946] border-l-4 border-[#333]/20 relative"
            >
                {/* Fabric Texture/Fold gradients */}
                <div className="absolute inset-0 bg-linear-to-r from-black/20 via-transparent to-black/20 opacity-50" />
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(0,0,0,0.1)_50px,transparent_60px)] opacity-30" />
            </motion.div>
        </div>
    );
};

export default CurtainTransition;

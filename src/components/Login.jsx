import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { useStore } from '../store';

const Login = () => {
    const [inputValue, setInputValue] = useState('');
    const { setPhase, setUserType, setNickname } = useStore();

    const handleLogin = (e) => {
        e.preventDefault();
        const input = inputValue.trim().toUpperCase();

        setNickname(input || 'GUEST');

        if (input === 'VINCENT' || input === 'VIP') {
            setUserType('VIP');
        } else {
            setUserType('DEFAULT');
        }

        // Easter Egg: Skip story if nickname is 'SKIP'
        if (input === 'SKIP') {
            setPhase('BOOTH');
        } else {
            setPhase('STORY');
        }
    };

    // Stickers for the footer grid
    const stickers = Array.from({ length: 16 }, (_, i) => `/stickers/Artboard ${i + 1}.webp`);

    return (
        <div className="flex flex-col h-full w-full bg-white overflow-y-auto font-black">
            {/* Header */}
            <header className="bg-cute-pink py-6 text-center shrink-0">
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-lg">
                    Boothy Photobooth
                </h1>
                <p className="text-white/90 text-lg mt-1 font-medium italic">
                    made with ❤️ by vincent
                </p>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-4 relative">

                <div className="flex flex-col items-center gap-4 z-10 w-full max-w-md">
                    <h2 className="text-xl font-bold text-black">Login with anything</h2>

                    {/* Login Card */}
                    <div className="bg-cute-pink rounded-[2.5rem] px-8 pt-4 pb-4 w-full h-auto flex flex-col items-center shadow-lg relative overflow-hidden">

                        <div className="w-full flex flex-col items-center gap-2">
                            <label className="text-white/80 text-md font-medium italic">name</label>
                            <form onSubmit={handleLogin} className="w-full">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="enter your nickname"
                                    className="w-full bg-white rounded-full px-6 py-3 text-center text-gray-600 placeholder:text-gray-300 focus:outline-none shadow-sm text-lg"
                                    autoFocus
                                />
                            </form>
                        </div>

                        {/* Hero Sticker Area */}
                        <div className="flex-1 flex items-end justify-center w-full mt-4 min-h-0">
                            {/* Placeholder for the large sticker in the design */}
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="max-h-full filter drop-shadow-lg"
                            >
                                <img src="/assets/Asset 17.webp" alt="Sticker" className="max-h-full w-auto object-contain" />
                            </motion.div>
                        </div>
                    </div>
                </div>

            </main>

            {/* Footer Sticker Grid */}
            <footer className="bg-cute-pink py-8 px-4 shrink-0">
                <div className="max-w-4xl mx-auto grid grid-cols-4 md:grid-cols-8 gap-8 justify-items-center">
                    {stickers.map((sticker, index) => {
                        // Generate random values for "organic" feel
                        // We use a fixed seed based on index to keep it consistent across re-renders if possible,
                        // but for this simple component, simple math is fine.
                        // To avoid hydration mismatches in a real SSR app we'd use useEffect, 
                        // but for this client-side app simple random is okay or we can use index-based pseudo-random.
                        const rotate = (index % 2 === 0 ? 1 : -1) * ((index * 7) % 15); // Pseudo-random rotation
                        const duration = 2 + (index % 3) * 0.5; // Pseudo-random duration
                        const delay = (index % 5) * 0.2;

                        return (
                            <motion.div
                                key={index}
                                initial={{ rotate: rotate, y: 0 }}
                                animate={{
                                    y: [-8, 8, -8],
                                    transition: {
                                        duration: duration,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: delay,
                                    }
                                }}
                                whileHover={{
                                    scale: 1.2,
                                    rotate: 0,
                                    transition: { type: "spring", stiffness: 400, damping: 10 }
                                }}
                                className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transform transition-colors hover:bg-white/90"
                            >
                                <img src={sticker} alt={`Sticker ${index + 1}`} className="w-12 h-12 object-contain" />
                            </motion.div>
                        );
                    })}
                </div>
            </footer>
        </div>
    );
};

export default Login;

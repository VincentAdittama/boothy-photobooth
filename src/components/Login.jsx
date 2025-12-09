import React, { useState, useEffect, useRef } from 'react';
import { motion as Motion, useMotionValue, useSpring } from 'framer-motion';
import { useStore } from '../store';

const Login = () => {
    const [inputValue, setInputValue] = useState('');
    const { setPhase, setUserType, setNickname } = useStore();
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [velocity, setVelocity] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const mouseRef = useRef({ x: 0, y: 0 });
    const velRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(null);

    // motion values for smooth rotation
    const rotateMV = useMotionValue(0);
    const rotateSpring = useSpring(rotateMV, { stiffness: 320, damping: 30 });

    useEffect(() => {
        // Smooth pointer updates: write raw mouse values to refs in mousemove then
        // read from refs in a RAF loop to update React state at consistent frames.
        let prevPos = { x: 0, y: 0 };
        let prevTime = Date.now();
        let running = true;

        const handleMouseMove = (e) => {
            const currentTime = Date.now();
            const dt = Math.max(currentTime - prevTime, 1);
            const currentPos = { x: e.clientX, y: e.clientY };
            const velX = (currentPos.x - prevPos.x) / dt * 1000;
            const velY = (currentPos.y - prevPos.y) / dt * 1000;

            mouseRef.current = currentPos;
            velRef.current = { x: velX, y: velY };
            prevPos = currentPos;
            prevTime = currentTime;
        };

        const loop = () => {
            // snap local state to ref values each rAF for consistent animation updates
            setMousePos({ ...mouseRef.current });
            setVelocity({ ...velRef.current });
            if (running) rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            running = false;
            window.removeEventListener('mousemove', handleMouseMove);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // Update rotate MV to reflect current velocity; this reduces jitter by
    // animating with useSpring for the stick.
    useEffect(() => {
        const tiltDeg = Math.min(Math.max((velocity.x || 0) * 0.02 - (velocity.y || 0) * 0.004, -14), 14);
        rotateMV.set(tiltDeg);
    }, [velocity.x, velocity.y]);

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
                            <Motion.div
                                whileHover={{ scale: 1.05 }}
                                onMouseEnter={(e) => {
                                    // set current pointer immediately to prevent jump
                                    const next = { x: e.clientX, y: e.clientY };
                                    mouseRef.current = next;
                                    setMousePos(next);
                                    setVelocity({ x: 0, y: 0 });
                                    setIsHovering(true);
                                }}
                                onMouseLeave={() => setIsHovering(false)}
                                onClick={handleLogin}
                                className="max-h-full filter drop-shadow-lg cursor-pointer"
                            >
                                <img src="/assets/Asset 17.webp" alt="Sticker" className="max-h-full w-auto object-contain" />
                            </Motion.div>

                            {isHovering && (() => {
                                const BOARD_W = 180;
                                const BOARD_H = 46;
                                const STICK_LEN = 54;
                                const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
                                const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
                                const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
                                const targetCenterX = clamp(mousePos.x, BOARD_W / 2 + 12, vw - BOARD_W / 2 - 12);
                                const targetCenterY = clamp(mousePos.y - STICK_LEN - BOARD_H / 2, 12, vh - BOARD_H - 12);
                                const targetLeft = targetCenterX - BOARD_W / 2;
                                const targetTop = targetCenterY - BOARD_H / 2;
                                const tiltDeg = clamp((velocity.x || 0) * 0.02 - (velocity.y || 0) * 0.004, -14, 14);

                                return (
                                    <Motion.div
                                        // initial position now follows the pointer so it doesn't jump from 0,0
                                        initial={{ opacity: 0, scale: 0.85, x: targetLeft, y: targetTop }}
                                        animate={{ opacity: 1, scale: 1, x: targetLeft, y: targetTop }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                                        style={{ position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: 1000 }}
                                    >
                                        <Motion.div
                                            style={{
                                                width: BOARD_W,
                                                // auto height
                                                rotate: rotateSpring,
                                                transformOrigin: '50% 100px', // Pivot approx where the hand holds it (below the board)
                                                filter: 'drop-shadow(0px 10px 10px rgba(0,0,0,0.2))'
                                            }}
                                            className="relative flex flex-col items-center pointer-events-none"
                                        >
                                            <div className="relative w-full text-center bg-amber-700 border-4 border-amber-900 rounded-lg px-4 py-2 text-white font-black text-sm shadow-inner transform -translate-y-1">
                                                <div className="absolute inset-0 border-2 border-[#ffffff20] rounded-lg pointer-events-none"></div>
                                                ENTER BOOTHY
                                                {/* little nails */}
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-950 shadow-sm border border-amber-800" />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-950 shadow-sm border border-amber-800" />
                                            </div>

                                            {/* The Stick */}
                                            <div
                                                style={{
                                                    width: 14,
                                                    height: STICK_LEN + 20,
                                                    background: 'linear-gradient(90deg, #3E2723 0%, #5D4037 45%, #795548 50%, #5D4037 55%, #3E2723 100%)',
                                                    borderRadius: '0 0 10px 10px',
                                                    marginTop: -5,
                                                    zIndex: -1
                                                }}
                                            />
                                        </Motion.div>
                                    </Motion.div>
                                );
                            })()}
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
                            <Motion.div
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
                            </Motion.div>
                        );
                    })}
                </div>
            </footer>
        </div>
    );
};

export default Login;

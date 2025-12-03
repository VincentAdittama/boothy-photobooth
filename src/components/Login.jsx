import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';

const Login = () => {
    const [inputValue, setInputValue] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    const { setPhase, setUserType } = useStore();

    const handleLogin = (e) => {
        e.preventDefault();
        const input = inputValue.trim().toUpperCase();

        if (input === 'VINCENT' || input === 'VIP') {
            setUserType('VIP');
        } else {
            setUserType('DEFAULT');
        }

        setIsUnlocking(true);

        // Simulate unlock animation delay
        setTimeout(() => {
            setPhase('STORY');
        }, 2000);
    };

    return (
        <div className="flex items-center justify-center h-screen bg-black text-white overflow-hidden relative">
            <AnimatePresence>
                {!isUnlocking ? (
                    <motion.form
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5 }}
                        onSubmit={handleLogin}
                        className="z-10 flex flex-col items-center gap-6"
                    >
                        <h1 className="text-4xl font-light tracking-[0.2em] uppercase text-center">
                            Identity Verification
                        </h1>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="ENTER CODE NAME"
                            className="bg-transparent border-b border-white/30 text-center text-2xl py-2 px-4 focus:outline-none focus:border-white transition-colors w-80 font-mono tracking-widest uppercase placeholder:text-white/20"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="mt-4 px-8 py-2 border border-white/30 hover:bg-white hover:text-black transition-all duration-300 uppercase tracking-widest text-sm"
                        >
                            Access
                        </button>
                    </motion.form>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center bg-white text-black z-20"
                    >
                        <GlitchText text="ACCESS GRANTED" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Background Ambient Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-50 pointer-events-none" />
        </div>
    );
};

const GlitchText = ({ text }) => {
    return (
        <motion.h1
            className="text-6xl font-bold tracking-tighter glitch-effect"
            animate={{
                x: [-2, 2, -2, 0],
                y: [2, -2, 2, 0],
                opacity: [1, 0.8, 1],
            }}
            transition={{
                duration: 0.2,
                repeat: Infinity,
                repeatType: "mirror",
            }}
        >
            {text}
        </motion.h1>
    );
};

export default Login;

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
        }, 1500);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-cute-bg relative overflow-hidden">

            {/* Decorative Background Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cute-pink rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-bounce-slight" />
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-cute-mint rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-bounce-slight" style={{ animationDelay: '1s' }} />
            <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-cute-purple rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-bounce-slight" style={{ animationDelay: '2s' }} />

            <AnimatePresence>
                {!isUnlocking ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, rotate: -5 }}
                        className="z-10 bg-white/80 backdrop-blur-sm p-12 rounded-[3rem] shadow-xl border-4 border-white flex flex-col items-center gap-8 max-w-md w-full mx-4"
                    >
                        {/* Hero Sticker Placeholder */}
                        <motion.div
                            className="w-32 h-32 bg-cute-yellow rounded-full flex items-center justify-center text-4xl mb-2 shadow-inner"
                            whileHover={{ scale: 1.1, rotate: 10 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            ✨
                            {/* <img src="/stickers/hero.webp" alt="Welcome" className="w-full h-full object-contain" /> */}
                        </motion.div>

                        <div className="text-center">
                            <h1 className="text-4xl font-bold text-cute-text mb-2">Welcome!</h1>
                            <p className="text-cute-text/60 font-medium">Enter your secret code to start</p>
                        </div>

                        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="YOUR CODE"
                                className="w-full bg-cute-bg border-2 border-transparent focus:border-cute-pink rounded-2xl px-6 py-4 text-center text-xl font-bold text-cute-text placeholder:text-cute-text/30 outline-none transition-all shadow-sm"
                                autoFocus
                            />
                            <motion.button
                                type="submit"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="w-full bg-cute-pink text-white font-bold text-xl py-4 rounded-2xl shadow-lg hover:shadow-xl hover:bg-red-300 transition-all"
                            >
                                Let's Go!
                            </motion.button>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="z-20 flex flex-col items-center justify-center gap-6"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="text-6xl"
                        >
                            🌸
                        </motion.div>
                        <h1 className="text-4xl font-bold text-cute-text">Yay! Access Granted!</h1>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Login;

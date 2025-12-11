import { useState, useEffect, useRef } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

export const useMousePhysics = () => {
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
    }, [velocity.x, velocity.y, rotateMV]);

    return {
        mousePos,
        velocity,
        isHovering,
        setIsHovering,
        rotateSpring,
        setMousePos, // Exposed in case we need to manually set it (e.g. onMouseEnter)
        setVelocity,
        mouseRef // Exposed for immediate updates
    };
};

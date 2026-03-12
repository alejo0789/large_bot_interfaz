import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, CheckCircle2 } from 'lucide-react';

const Celebration = ({ isVisible, onClose, message = "¡Felicitaciones! Cerraste esta agenda" }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 10000,
                    pointerEvents: 'none',
                    overflow: 'hidden'
                }}>
                    {/* Confetti Particles (Simplified CSS version) */}
                    {[...Array(80)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ 
                                x: `${Math.random() * 100}vw`, 
                                y: '-50px', // Start above top
                                opacity: 1,
                                scale: Math.random() * 0.8 + 0.4,
                                rotate: 0
                            }}
                            animate={{ 
                                y: '110vh', // Fall down
                                opacity: [1, 1, 1, 0],
                                rotate: Math.random() * 360 * 4
                            }}
                            transition={{ 
                                duration: Math.random() * 2 + 2,
                                ease: "linear"
                            }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '12px',
                                height: '12px',
                                backgroundColor: ['#FFD700', '#FF4500', '#1E90FF', '#32CD32', '#FF69B4', '#9333EA'][i % 6],
                                borderRadius: i % 2 === 0 ? '50%' : '2px',
                                boxShadow: '0 0 5px rgba(0,0,0,0.1)'
                            }}
                        />
                    ))}
                </div>
            )}
        </AnimatePresence>
    );
};

export default Celebration;

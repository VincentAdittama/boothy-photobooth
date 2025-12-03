export const storyDatabase = {
    DEFAULT: {
        theme: {
            background: '#1a1a1a',
            text: '#ffffff',
            accent: '#3b82f6', // blue-500
        },
        chapters: [
            { text: "Welcome, Traveler.", delay: 2000 },
            { text: "You have arrived at the threshold.", delay: 3000 },
            { text: "Your journey is just beginning...", delay: 3000 },
            { text: "Prepare yourself.", delay: 2000 },
        ],
    },
    VIP: {
        theme: {
            background: '#0f172a', // slate-900
            text: '#e2e8f0', // slate-200
            accent: '#8b5cf6', // violet-500
        },
        chapters: [
            { text: "Welcome back, Agent.", delay: 2000 },
            { text: "System access granted. Level 5 clearance confirmed.", delay: 3000 },
            { text: "The glitch in the matrix has been stabilized.", delay: 3000 },
            { text: "Proceed to target acquisition.", delay: 2000 },
        ],
    },
};

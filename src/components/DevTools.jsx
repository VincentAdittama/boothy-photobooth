import React, { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { getMockStripSeed } from '../utils/mockLivePhoto';

const PHASES = ['', 'LOGIN', 'STORY', 'BOOTH', 'STUDIO'];

const DevTools = () => {
    const devTools = useStore((s) => s.devTools);
    const setDevTools = useStore((s) => s.setDevTools);
    const toggleDevToolsOpen = useStore((s) => s.toggleDevToolsOpen);

    const currentPhase = useStore((s) => s.currentPhase);
    const nickname = useStore((s) => s.nickname);
    const setNickname = useStore((s) => s.setNickname);

    const setPhase = useStore((s) => s.setPhase);
    const setCapturedImages = useStore((s) => s.setCapturedImages);
    const setCapturedImage = useStore((s) => s.setCapturedImage);
    const setCapturedImageIsMirrored = useStore((s) => s.setCapturedImageIsMirrored);
    const setLivePhotoFrames = useStore((s) => s.setLivePhotoFrames);
    const resetLivePhotoState = useStore((s) => s.resetLivePhotoState);
    const resetSession = useStore((s) => s.resetSession);
    const nicknameInputRef = useRef(null);

    const isOpen = Boolean(devTools?.isOpen);

    const phaseSummary = useMemo(() => {
        const uploads = devTools?.uploadsEnabled ? 'ON' : 'OFF';
        const skipStory = devTools?.skipStoryAfterLogin ? 'ON' : 'OFF';
        const def = devTools?.defaultPhaseOnLoad ? devTools.defaultPhaseOnLoad : '—';
        return `Phase: ${currentPhase} • Nick: ${nickname || '—'} • Uploads: ${uploads} • Skip story: ${skipStory} • Default: ${def}`;
    }, [currentPhase, nickname, devTools?.uploadsEnabled, devTools?.skipStoryAfterLogin, devTools?.defaultPhaseOnLoad]);

    useEffect(() => {
        const onKeyDown = (e) => {
            const isD = String(e.key || '').toLowerCase() === 'd';
            if (!isD) return;
            if (!(e.shiftKey && (e.metaKey || e.ctrlKey))) return;
            e.preventDefault();
            toggleDevToolsOpen();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [toggleDevToolsOpen]);

    const applyNickname = () => {
        const raw = nicknameInputRef.current ? nicknameInputRef.current.value : '';
        const next = String(raw || '').trim().toUpperCase();
        setNickname(next || 'GUEST');
    };

    const seedMockStrip = () => {
        const seed = getMockStripSeed();
        resetLivePhotoState();
        setCapturedImages(seed.images);
        setCapturedImage(seed.capturedImage);
        setCapturedImageIsMirrored(seed.capturedImageIsMirrored);
        setLivePhotoFrames(seed.livePhotoFrames);
    };

    const goToPhase = (phase) => {
        if (phase === 'STUDIO') {
            seedMockStrip();
        }
        setPhase(phase);
    };

    return (
        <div className="fixed bottom-3 left-3 z-[10000] select-none">
            {!isOpen && (
                <button
                    type="button"
                    className="px-3 py-2 rounded-full bg-black text-white text-xs font-black shadow-lg"
                    onClick={toggleDevToolsOpen}
                    title="Open DevTools (Cmd/Ctrl+Shift+D)"
                >
                    DEV
                </button>
            )}

            {isOpen && (
                <div className="w-[340px] max-w-[92vw] rounded-3xl bg-white border-4 border-black shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-cute-pink text-white">
                        <div className="font-black tracking-tight">DevTools</div>
                        <button
                            type="button"
                            className="px-3 py-1 rounded-full bg-white text-black text-xs font-black"
                            onClick={toggleDevToolsOpen}
                        >
                            Close
                        </button>
                    </div>

                    <div className="px-4 py-3 text-xs font-medium text-black/80">
                        {phaseSummary}
                    </div>

                    <div className="px-4 pb-4 space-y-3">
                        <div className="space-y-2">
                            <div className="text-sm font-black">Nickname</div>
                            <div className="flex items-center gap-2">
                                <input
                                    key={nickname || 'GUEST'}
                                    ref={nicknameInputRef}
                                    defaultValue={nickname || ''}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            applyNickname();
                                        }
                                    }}
                                    className="flex-1 bg-white border-2 border-black rounded-full px-3 py-2 text-sm font-black"
                                    placeholder="e.g. VINCENT"
                                />
                                <button
                                    type="button"
                                    className="px-3 py-2 rounded-2xl bg-black text-white text-sm font-black"
                                    onClick={applyNickname}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        <label className="flex items-center justify-between gap-3 text-sm font-black">
                            <span>Upload to Supabase</span>
                            <input
                                type="checkbox"
                                checked={Boolean(devTools?.uploadsEnabled)}
                                onChange={(e) => setDevTools({ uploadsEnabled: e.target.checked })}
                            />
                        </label>

                        <label className="flex items-center justify-between gap-3 text-sm font-black">
                            <span>Skip story after login</span>
                            <input
                                type="checkbox"
                                checked={Boolean(devTools?.skipStoryAfterLogin)}
                                onChange={(e) => setDevTools({ skipStoryAfterLogin: e.target.checked })}
                            />
                        </label>

                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-black">Default phase on reload</div>
                            <select
                                className="bg-white border-2 border-black rounded-full px-3 py-1 text-sm font-black"
                                value={devTools?.defaultPhaseOnLoad || ''}
                                onChange={(e) => setDevTools({ defaultPhaseOnLoad: e.target.value })}
                            >
                                {PHASES.map((p) => (
                                    <option key={p} value={p}>
                                        {p === '' ? '—' : p}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                className="px-3 py-2 rounded-2xl bg-black text-white text-sm font-black"
                                onClick={() => goToPhase('LOGIN')}
                            >
                                Go: LOGIN
                            </button>
                            <button
                                type="button"
                                className="px-3 py-2 rounded-2xl bg-black text-white text-sm font-black"
                                onClick={() => goToPhase('STORY')}
                            >
                                Go: STORY
                            </button>
                            <button
                                type="button"
                                className="px-3 py-2 rounded-2xl bg-black text-white text-sm font-black"
                                onClick={() => goToPhase('BOOTH')}
                            >
                                Go: BOOTH
                            </button>
                            <button
                                type="button"
                                className="px-3 py-2 rounded-2xl bg-black text-white text-sm font-black"
                                onClick={() => goToPhase('STUDIO')}
                            >
                                Go: STUDIO
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                className="px-3 py-2 rounded-2xl bg-white border-2 border-black text-black text-sm font-black"
                                onClick={seedMockStrip}
                            >
                                Seed mock strip
                            </button>
                            <button
                                type="button"
                                className="px-3 py-2 rounded-2xl bg-white border-2 border-black text-black text-sm font-black"
                                onClick={resetSession}
                            >
                                Reset session
                            </button>
                        </div>
                    </div>

                    <div className="px-4 pb-4 text-[11px] text-black/60 font-medium">
                        Hotkey: Cmd/Ctrl+Shift+D
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevTools;

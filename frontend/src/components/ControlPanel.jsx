import React, { useState } from 'react';

function ControlPanel() {
    const [loading, setLoading] = useState(null);

    const injectFailure = async (type, target = null) => {
        const id = target || type;
        setLoading(id);
        try {
            await fetch('http://localhost:3001/api/telemetry/inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, targetModule: target })
            });
        } catch (e) {
            console.error(e);
        } finally {
            setTimeout(() => setLoading(null), 1000);
        }
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-red-900/50 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-red-400">System Stress Simulation</h2>
            <p className="text-[10px] text-gray-400 mb-4 uppercase font-bold tracking-widest">Inject Cluster Anomalies</p>

            <div className="grid grid-cols-3 gap-2 mb-6">
                <button
                    onClick={() => injectFailure('MEMORY_LEAK')}
                    disabled={loading === 'MEMORY_LEAK'}
                    className="p-2 bg-purple-900/30 hover:bg-purple-800 border border-purple-700/50 rounded text-purple-200 text-[9px] font-bold uppercase transition-all"
                >
                    {loading === 'MEMORY_LEAK' ? '...' : '💧 Memory'}
                </button>
                <button
                    onClick={() => injectFailure('CPU_SPIKE')}
                    disabled={loading === 'CPU_SPIKE'}
                    className="p-2 bg-orange-900/30 hover:bg-orange-800 border border-orange-700/50 rounded text-orange-200 text-[9px] font-bold uppercase transition-all"
                >
                    {loading === 'CPU_SPIKE' ? '...' : 'CPU'}
                </button>
                <button
                    onClick={() => injectFailure('LATENCY_DEGRADATION')}
                    disabled={loading === 'LATENCY_DEGRADATION'}
                    className="p-2 bg-amber-900/30 hover:bg-amber-800 border border-amber-700/50 rounded text-amber-200 text-[9px] font-bold uppercase transition-all"
                >
                    {loading === 'LATENCY_DEGRADATION' ? '...' : ' Latency'}
                </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
                <button
                    onClick={async () => {
                        setLoading('CLEAR');
                        await fetch('http://localhost:3001/api/telemetry/clear', { method: 'POST' });
                        setTimeout(() => setLoading(null), 1000);
                    }}
                    className="w-full p-2 bg-gray-700 hover:bg-gray-600 border border-gray-500 rounded text-gray-200 text-xs font-bold transition-all"
                >
                    {loading === 'CLEAR' ? 'Clearing...' : '🧹 Reset Cluster State'}
                </button>

                <button
                    onClick={async () => {
                        setLoading('PATCH');
                        await fetch('http://localhost:3001/api/patches/auto', { method: 'POST' });
                        setTimeout(() => setLoading(null), 1000);
                    }}
                    className="w-full p-2 bg-green-900/40 hover:bg-green-800 border border-green-700 rounded text-green-200 text-xs font-bold transition-all"
                >
                    {loading === 'PATCH' ? 'Healing...' : '🩹 Run Auto-Healing Pipeline'}
                </button>
            </div>
        </div>
    );
}

export default ControlPanel;

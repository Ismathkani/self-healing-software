import React from 'react';

function PatchTimeline({ patches }) {
    if (!patches || patches.length === 0) {
        return (
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg min-h-[200px] flex items-center justify-center">
                <span className="text-gray-500 italic">No patches deployed yet.</span>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-green-400">Micro-Patch Timeline</h2>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {patches.map((p, i) => (
                    <div key={i} className="flex gap-3 items-start bg-gray-900/50 p-3 rounded border border-gray-700">
                        <div className="mt-1 min-w-[10px] min-h-[10px] rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-green-300 font-mono text-sm">{p.strategy}</span>
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 border border-gray-600">{p.status}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{p.description}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-1">{new Date(p.timestamp).toLocaleTimeString()}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PatchTimeline;

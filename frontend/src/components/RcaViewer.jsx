import React from 'react';

function RcaViewer({ prediction }) {
    const rootCause = prediction?.rootCauseHint || 'Scanning...';
    const failureType = prediction?.predictedFailureType || 'NONE';

    // Simple module list for visualization
    const modules = [
        'Auth Service', 'API Gateway', 'User Service',
        'Order Service', 'Payment Service', 'Database', 'Cache'
    ];

    // Heuristic highlighting
    const getStatus = (mod) => {
        if (failureType === 'NONE') return 'bg-gray-700 border-gray-600';
        if (failureType === 'DATABASE_TIMEOUT' && mod === 'Database') return 'bg-red-900 border-red-500 animate-pulse';
        if (failureType === 'MEMORY_LEAK' && mod === 'API Gateway') return 'bg-red-900 border-red-500 animate-pulse';
        if (failureType === 'LATENCY_DEGRADATION' && mod === 'Payment Service') return 'bg-yellow-900 border-yellow-500';
        return 'bg-gray-700 border-gray-600 opacity-50';
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg h-full">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Root Cause Analysis</h2>

            <div className="mb-4 bg-gray-900 p-3 rounded border-l-4 border-cyan-500">
                <span className="block text-xs text-cyan-300 uppercase">Diagnosed Root Cause</span>
                <span className="text-lg font-mono text-white">{rootCause}</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {modules.map(mod => (
                    <div key={mod} className={`p-3 rounded border text-center text-sm font-semibold transition-all ${getStatus(mod)}`}>
                        {mod}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default RcaViewer;

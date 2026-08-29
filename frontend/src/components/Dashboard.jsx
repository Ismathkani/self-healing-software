import React, { useState, useEffect } from 'react';
import HealthMonitor from './HealthMonitor';
import ControlPanel from './ControlPanel';
import RcaViewer from './RcaViewer';
import PatchTimeline from './PatchTimeline';

function Dashboard() {
    const [telemetry, setTelemetry] = useState({ cpu: 0, memory: 0, latency: 0, errors: 0 });
    const [rawHistory, setRawHistory] = useState([]);
    const [prediction, setPrediction] = useState(null);
    const [patches, setPatches] = useState([]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchTelemetry();
            fetchPatches();
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchTelemetry = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/telemetry/snapshot');
            if (res.ok) {
                const data = await res.json();
                setTelemetry({
                    cpu: data.cpuPercent ?? 0,
                    memory: parseFloat(data.memory?.heapUsedMB ?? data.memory?.rssMB ?? 0),
                    latency: data.latencyMs ?? 0,
                    errors: 0,
                });

                // Add to raw history (keep last 10)
                setRawHistory(prev => [data, ...prev].slice(0, 10));
            }

            const predRes = await fetch('http://localhost:3001/api/predict/latest');
            if (predRes.ok) {
                const predData = await predRes.json();
                setPrediction(predData);
            }
        } catch (e) { console.error('Telemetry fetch failed', e); }
    };

    const fetchPatches = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/patches/history');
            if (res.ok) {
                const data = await res.json();
                setPatches(Array.isArray(data) ? data : (data.patches ?? []));
            }
        } catch (e) { console.error('Patch fetch failed', e); }
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 font-mono">
            <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-cyan-400">SELF-HEALING SYSTEM</h1>
                    <p className="text-gray-400 text-sm">Real-Time Failure Prediction & Micro-Patching</p>
                </div>
                <div className="flex gap-4">
                    <div className={`px-4 py-2 rounded ${prediction?.failureProbability > 0.5 ? 'bg-red-900 animate-pulse' : 'bg-green-900'}`}>
                        SYSTEM RISKS: {prediction?.predictedFailureType || 'NONE'}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-6">
                {/* Left Column: Health & Controls */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <HealthMonitor data={telemetry} prediction={prediction} />
                    <ControlPanel />

                    {/* Raw Data Section */}
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
                        <h2 className="text-xl font-bold mb-4 text-cyan-400">Raw Telemetry Log</h2>
                        <div className="bg-black/50 p-2 rounded max-h-[300px] overflow-y-auto text-[10px] space-y-1 font-mono">
                            {rawHistory.map((item, idx) => (
                                <div key={idx} className="border-b border-gray-800 pb-1">
                                    <span className="text-gray-500">[{new Date(item.timestamp).toLocaleTimeString()}]</span>
                                    <span className="text-green-400 ml-2">CPU: {item.cpuPercent}%</span>
                                    <span className="text-blue-400 ml-2">MEM: {item.memory?.heapUsedMB}MB</span>
                                    {item.faultActive && <span className="text-red-500 font-bold ml-2">FAULT: {item.faultActive}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: RCA & Patches */}
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    <RcaViewer prediction={prediction} />
                    <PatchTimeline patches={patches} />
                </div>
            </div>
        </div>
    );
}

export default Dashboard;

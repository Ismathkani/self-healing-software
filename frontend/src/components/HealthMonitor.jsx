import React from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

function HealthMonitor({ data, prediction }) {
    const cpu = Number(data?.cpu ?? 0);
    const memory = Number(data?.memory ?? 0);
    const latency = Number(data?.latency ?? 0);
    const failureProb = prediction?.failureProbability || 0;

    // Gauge color based on load
    const getCpuColor = (val) => val > 80 ? 'bg-red-500' : val > 50 ? 'bg-yellow-500' : 'bg-green-500';
    const getMemColor = (val) => val > 300 ? 'bg-red-500' : val > 150 ? 'bg-yellow-500' : 'bg-green-500';

    const probPercent = (failureProb * 100).toFixed(1);

    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-200">System Telemetry</h2>

            {/* Failure Probability Gauge */}
            <div className="flex flex-col items-center mb-6 p-4 bg-gray-900 rounded-lg">
                <span className="text-gray-400 text-sm mb-1">FAILURE PROBABILITY (AI PREDICTION)</span>
                <div className="relative w-full h-6 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${failureProb > 0.5 ? 'bg-red-600' : 'bg-blue-500'}`}
                        style={{ width: `${probPercent}%` }}
                    ></div>
                </div>
                <span className="mt-2 text-2xl font-mono font-bold text-white">{probPercent}%</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* CPU Stats */}
                <div className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-300">CPU Usage</span>
                        <span className="text-xs font-bold">{cpu.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-900 h-2 rounded-full">
                        <div className={`h-full rounded-full transition-all ${getCpuColor(cpu)}`} style={{ width: `${Math.min(cpu, 100)}%` }}></div>
                    </div>
                </div>

                {/* Memory Stats */}
                <div className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-300">Memory (MB)</span>
                        <span className="text-xs font-bold">{memory.toFixed(0)}</span>
                    </div>
                    <div className="w-full bg-gray-900 h-2 rounded-full">
                        <div className={`h-full rounded-full transition-all ${getMemColor(memory)}`} style={{ width: `${Math.min(memory / 500 * 100, 100)}%` }}></div>
                    </div>
                </div>

                {/* Latency Stats */}
                <div className="col-span-2 bg-gray-700 p-3 rounded">
                    <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-300">Latency (ms)</span>
                        <span className="text-xs font-bold">{latency.toFixed(0)}ms</span>
                    </div>
                    <div className="w-full bg-gray-900 h-2 rounded-full">
                        <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.min(latency / 1000 * 100, 100)}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HealthMonitor;

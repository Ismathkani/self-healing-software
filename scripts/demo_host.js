

const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 4000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

app.use(cors());
app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    next();
});
app.use(express.static(path.join(__dirname, '../demo_website')));

// Simulation state (fetched from backend)
let activePatches = [];
let activeFault = null;

async function refreshSimulationState() {
    try {
        const patchRes = await axios.get(`${BACKEND_URL}/api/patches/history`);
        activePatches = (patchRes.data.patches || []).filter(p => p.status === 'LIVE');

        const faultRes = await axios.get(`${BACKEND_URL}/api/telemetry/active-fault`);
        activeFault = faultRes.data.activeFault;
    } catch (e) { }
}
setInterval(refreshSimulationState, 1500);

// PATCH APPLICATOR + FAULT SIMULATOR MIDDLEWARE
app.use(async (req, res, next) => {
    const isCpuPatch = activePatches.some(p => p.failureType === 'CPU_SPIKE');
    const isLatPatch = activePatches.some(p => p.failureType === 'LATENCY_DEGRADATION');
    const isMemPatch = activePatches.some(p => p.failureType === 'MEMORY_LEAK');

    // Simulate real lag if fault is active and NO patch is applied
    if ((activeFault === 'LATENCY_DEGRADATION' && !isLatPatch) ||
        (activeFault === 'CPU_SPIKE' && !isCpuPatch)) {
        const delay = 1500 + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));
    }

    // Apply headers if patches are LIVE
    if (isCpuPatch) res.setHeader('X-Patched-LoadBalancer', 'Active');
    if (isLatPatch) res.setHeader('X-Patched-Timeout', '2000ms');
    if (isMemPatch) res.setHeader('X-Patch-Applied', 'MemoryLeakMitigation');

    next();
});

app.listen(PORT, () => {
    console.log(`\n🚀 Website hosted at: http://localhost:${PORT}`);
    console.log(`📡 Connected to Self-Healing Backend: ${BACKEND_URL}`);
});

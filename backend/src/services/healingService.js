const predictionService = require('./predictionService');
const rootCauseService = require('./rootCauseService');
const patchService = require('./patchService');

/**
 * Direct Remediation Engine (Bypassing Stage-by-Stage Workflow)
 */
class HealingService {
    constructor() {
        this.isResolving = false;
    }

    async remediate(samples) {
        if (this.isResolving) return; // Prevent overlapping remediation cycles

        try {
            // 1. Prediction for anomaly classification
            const prediction = await predictionService.predict(samples);
            
            // Strategy Gate: If system is healthy, do not initiate remediation or save patches
            if (prediction.predictedFailureType === 'NONE' || prediction.failureProbability < 0.3) {
                return { status: 'HEALTHY', prediction };
            }

            this.isResolving = true; // Lock the service for the duration of the healing cycle
            console.log(`[Healing] Initiating remediation protocol. Prediction: ${prediction.predictedFailureType}`);
            console.log(`[Healing] Anomaly verified. Phase 1: In-depth Causal Analysis (30s delay for simulation)...`);
            
            // Artificial delay to make the demo more realistic (per user request)
            await new Promise(resolve => setTimeout(resolve, 30000));

            // 2. Multi-Node Root Cause Analysis
            const rca = await rootCauseService.analyzeRootCause();
            const targetModule = rca.rootCause;
            
            console.log(`[Healing] RCA Result: ${targetModule} (Confidence: ${rca.confidence})`);
            
            if (targetModule === 'none' || targetModule === 'unknown') {
                console.log(`[Healing] RCA inconclusive. Releasing lock.`);
                this.isResolving = false;
                return { status: 'STABLE', prediction, rca };
            }

            console.log(`[Healing] Phase 2: Generating Strategy & Validating Hot-Patch for ${targetModule}...`);

            // 3. Strategy & Patch Generation
            const patch = patchService.generatePatch(prediction, { rootCause: targetModule });
            
            // 4. Pre-deployment Twin Validation
            const validation = await patchService.validateInTwin(patch);
            if (!validation.twinValidation.passed) {
                console.warn(`[Healing] Twin Validation FAILURE for ${targetModule}. Aborting safety deployment.`);
                this.isResolving = false;
                return { status: 'ABORTED', reason: 'Twin validation failed', rca };
            }

            // 5. Atomic Injection & Deployment
            console.log(`[Healing] Phase 3: Deploying patch ${patch.patchId} to ${targetModule}...`);
            await patchService.deployPatch(patch);
            
            // 6. CLEAR FAULT (AUTOMATIC RESOLUTION)
            const telemetryService = require('./telemetryService');
            telemetryService.clearSimulatedFaults();
            
            console.log(`[Healing] SUCCESS: Module [${targetModule}] recovered. Fault cleared.`);
            
            this.isResolving = false;
            return { status: 'RECOVERED', targetModule, patchId: patch.patchId };

        } catch (err) {
            console.error(`[Healing] Remediation FAILED:`, err);
            this.isResolving = false;
            throw err;
        }
    }
}

module.exports = new HealingService();

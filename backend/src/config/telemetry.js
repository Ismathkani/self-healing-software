let BasicTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter;
let resourceFromAttributes, SemanticResourceAttributes;
let trace;
let _otelAvailable = true;
const http = require('http');

try {
  ({ BasicTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base'));
  ({ resourceFromAttributes } = require('@opentelemetry/resources'));
  ({ SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions'));
  ({ trace } = require('@opentelemetry/api'));
} catch (err) {
  _otelAvailable = false;
  console.warn('[Telemetry] OpenTelemetry SDK not available — tracing disabled');
}

// ── In-memory registry for custom metrics ────────────────────
const metricsRegistry = {
  _gauges: {},
  _counters: {},

  gauge(name, labels = {}) {
    const key = name + JSON.stringify(labels);
    if (!this._gauges[key]) this._gauges[key] = { name, labels, value: 0 };
    return {
      set: (v) => { this._gauges[key].value = v; }
    };
  },

  counter(name, labels = {}) {
    const key = name + JSON.stringify(labels);
    if (!this._counters[key]) this._counters[key] = { name, labels, value: 0 };
    return {
      inc: (v = 1) => { this._counters[key].value += v; }
    };
  },

  toText() {
    let out = '';
    for (const m of Object.values(this._gauges)) {
      const lblStr = Object.entries(m.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      out += `# TYPE ${m.name} gauge\n`;
      out += `${m.name}${lblStr ? '{' + lblStr + '}' : ''} ${m.value}\n`;
    }
    for (const m of Object.values(this._counters)) {
      const lblStr = Object.entries(m.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      out += `# TYPE ${m.name} counter\n`;
      out += `${m.name}${lblStr ? '{' + lblStr + '}' : ''} ${m.value}\n`;
    }
    return out;
  }
};

// ── Public initialiser ───────────────────────────────────────
function initTelemetry() {
  // 1. Resource (OTel v2 compatible)
  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'self-heal-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0'
  });

  // 2. Tracer Provider (only if SDK loaded)
  if (BasicTracerProvider && typeof BasicTracerProvider === 'function') {
    const provider = new BasicTracerProvider({ resource });

    if (provider && typeof provider.addSpanProcessor === 'function') {
      provider.addSpanProcessor(
        new SimpleSpanProcessor(new ConsoleSpanExporter())
      );
      provider.register();
      console.log('OpenTelemetry tracing initialized');
    } else {
      console.warn('[Telemetry] Tracer provider missing addSpanProcessor — tracing disabled');
    }
  } else {
    console.warn('[Telemetry] OpenTelemetry SDK not loaded — skipping tracer setup');
  }

  // 3. Prometheus /metrics endpoint
  const metricsServer = http.createServer((req, res) => {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(metricsRegistry.toText());
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  metricsServer.listen(9090, () => {
    console.log('📊 Prometheus metrics → http://localhost:9090/metrics');
  });

  // tracing initialization logged above when applicable
}

// ── Named tracer for manual spans ───────────────────────────
const tracer = trace.getTracer('self-heal-backend');

module.exports = { initTelemetry, tracer, metricsRegistry };

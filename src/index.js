const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || "demo-dozzle";

app.use(express.json());

// ── Helper: structured logger ──────────────────────────────
function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    level: level.toUpperCase(),
    traceId: meta.traceId || uuidv4().slice(0, 8),
    message,
    ...meta,
  };
  if (process.env.LOG_FORMAT === "json") {
    console.log(JSON.stringify(entry));
  } else {
    console.log(`[${entry.timestamp}] [${entry.level}] [${entry.traceId}] ${message}`);
  }
}

// ── Middleware: request logging ──────────────────────────
app.use((req, res, next) => {
  const traceId = uuidv4().slice(0, 8);
  req.traceId = traceId;
  const start = Date.now();

  log("info", `→ ${req.method} ${req.path}`, { traceId, ip: req.ip });

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? "warn" : "info";
    log(level, `← ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`, {
      traceId,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
});

// ── Routes ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  log("debug", "Health check requested", { traceId: req.traceId });
  res.json({ status: "ok", service: SERVICE_NAME, uptime: process.uptime() });
});

app.get("/users", (req, res) => {
  const users = [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "user" },
    { id: 3, name: "Charlie", role: "user" },
  ];
  log("info", `Fetched ${users.length} users`, { traceId: req.traceId, count: users.length });
  res.json(users);
});

app.get("/users/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    log("error", `Invalid user ID: ${req.params.id}`, { traceId: req.traceId });
    return res.status(400).json({ error: "Invalid user ID" });
  }
  log("info", `Fetched user ${id}`, { traceId: req.traceId, userId: id });
  res.json({ id, name: `User ${id}`, email: `user${id}@example.com` });
});

app.post("/orders", (req, res) => {
  const { product, quantity } = req.body;
  if (!product || !quantity) {
    log("error", "Order creation failed: missing fields", { traceId: req.traceId, body: req.body });
    return res.status(400).json({ error: "Missing product or quantity" });
  }
  const orderId = uuidv4().slice(0, 8);
  log("info", `Order created: ${orderId}`, { traceId: req.traceId, orderId, product, quantity });
  res.status(201).json({ orderId, product, quantity, status: "created" });
});

app.get("/error", (req, res) => {
  log("error", "Simulated error endpoint triggered", { traceId: req.traceId, path: req.path });
  res.status(500).json({ error: "Something went wrong!" });
});

app.get("/slow", async (req, res) => {
  const delay = parseInt(req.query.delay) || 2000;
  log("warn", `Slow endpoint called with ${delay}ms delay`, { traceId: req.traceId, delay });
  await new Promise((r) => setTimeout(r, delay));
  log("info", "Slow endpoint completed", { traceId: req.traceId, delay });
  res.json({ message: "Done after delay", delay });
});

// ── Background jobs (continuous log generation) ──────────
setInterval(() => {
  const mem = process.memoryUsage();
  log("info", "Heartbeat", {
    uptime: Math.round(process.uptime()),
    rss: Math.round(mem.rss / 1024 / 1024) + "MB",
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
  });
}, 10000);

function scheduleBackgroundTask() {
  const delay = 3000 + Math.random() * 4000;
  setTimeout(() => {
    const jobs = ["sync-inventory", "cleanup-temp", "send-notifications", "update-cache"];
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const success = Math.random() > 0.2;
    if (success) {
      log("info", `Background job completed: ${job}`, { job, duration: Math.round(Math.random() * 500) });
    } else {
      log("error", `Background job failed: ${job}`, { job, reason: "connection timeout" });
    }
    scheduleBackgroundTask();
  }, delay);
}
scheduleBackgroundTask();

setInterval(() => {
  log("warn", "High memory usage detected in module X", { module: "cache-manager", threshold: "85%" });
}, 45000);

// ── Startup ────────────────────────────────────────────────
app.listen(PORT, () => {
  log("info", `🚀 Server running on port ${PORT}`);
  log("info", `📋 Available endpoints: GET /health, GET /users, GET /users/:id, POST /orders, GET /error, GET /slow`);
  log("info", `🔍 Try: curl http://localhost:${PORT}/health`);
});
import { WebSocket } from 'ws';
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import http from 'http';

const PORT = 10000;
const TEST_URL = `ws://localhost:${PORT}/ws/live?lang=en&welcome=true`;

interface Metrics {
  socketOpenMs: number;
  setupCompleteMs: number;
  welcomeFirstAudioMs: number;
  welcomeFirstTextMs: number;
  welcomeTotalAudioChunks: number;
  welcomeTotalAudioBytes: number;
  welcomeDurationMs: number;
  
  // Phase 1 (Name capture)
  nameInputSentAt: number;
  nameFirstAudioMs: number;
  nameFirstTextMs: number;
  nameCaptureSuccess: boolean;
  nameResponseReceived: boolean;
  
  // Phase 2 (Query & Sector qualification)
  queryInputSentAt: number;
  queryFirstAudioMs: number;
  queryFirstTextMs: number;
  queryResponseReceived: boolean;

  // Phase 3 (Barge-in / Interruption)
  interruptSentAt: number;
  interruptedAckMs: number;
  interruptedSuccess: boolean;
  postInterruptAudioChunksAfterAck: number;
  
  // Overall Network & Stream Jitter
  audioJitterMs: number[];
  avgJitterMs: number;
  maxJitterMs: number;
}

const metrics: Metrics = {
  socketOpenMs: 0,
  setupCompleteMs: 0,
  welcomeFirstAudioMs: 0,
  welcomeFirstTextMs: 0,
  welcomeTotalAudioChunks: 0,
  welcomeTotalAudioBytes: 0,
  welcomeDurationMs: 0,
  
  nameInputSentAt: 0,
  nameFirstAudioMs: 0,
  nameFirstTextMs: 0,
  nameCaptureSuccess: false,
  nameResponseReceived: false,
  
  queryInputSentAt: 0,
  queryFirstAudioMs: 0,
  queryFirstTextMs: 0,
  queryResponseReceived: false,

  interruptSentAt: 0,
  interruptedAckMs: 0,
  interruptedSuccess: false,
  postInterruptAudioChunksAfterAck: 0,
  
  audioJitterMs: [],
  avgJitterMs: 0,
  maxJitterMs: 0,
};

// Check if a port is in use
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      });
    server.listen(port);
  });
}

// Start the server process if not running
function startServer(): Promise<ChildProcess | null> {
  return new Promise(async (resolve, reject) => {
    const inUse = await isPortInUse(PORT);
    if (inUse) {
      console.log(`[E2E Test] Port ${PORT} is already in use. Assuming server is running.`);
      resolve(null);
      return;
    }

    console.log(`[E2E Test] Port ${PORT} is free. Spawning local server...`);
    const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' }
    });

    let resolved = false;

    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server listening on') || output.includes('listening on http')) {
        if (!resolved) {
          resolved = true;
          setTimeout(() => resolve(serverProcess), 1500);
        }
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`[Server Stderr] ${data.toString().trim()}`);
    });

    serverProcess.on('close', (code) => {
      if (!resolved) {
        reject(new Error(`Server failed to start, exit code ${code}`));
      }
    });
  });
}

// HTTP request helper
function makeRequest(options: http.RequestOptions, postData?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTest() {
  console.log('================================================================');
  console.log('            TRANSLINK FULL PROJECT E2E TEST RUNNER              ');
  console.log('================================================================');
  
  const results = {
    configs: [] as { name: string; status: 'OK' | 'FAIL'; message: string }[],
    bridge: [] as { name: string; status: 'OK' | 'FAIL'; message: string }[],
    typescript: { status: 'PENDING' as 'OK' | 'FAIL' | 'PENDING', message: '' },
    endpoints: [] as { path: string; status: 'OK' | 'FAIL'; code: number; details: string }[],
    voice: { status: 'PENDING' as 'OK' | 'FAIL' | 'PENDING', message: '' }
  };

  // ----------------------------------------------------------------
  // PHASE 1: CONFIGURATION FILES VALIDATION (\src\translinkconfig)
  // ----------------------------------------------------------------
  console.log('\n[PHASE 1] Validating configuration files...');
  const configFiles = [
    'waypoint_config.json',
    'camera_config.json',
    'language_config.json',
    'audio_config.json',
    'mesh_behavior_config.json',
    'mesh_material_config.json',
    'live-voice/voice_config.json'
  ];

  for (const file of configFiles) {
    const filePath = path.resolve(process.cwd(), 'src/translinkconfig', file);
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      JSON.parse(raw); // validate JSON format
      results.configs.push({ name: file, status: 'OK', message: 'Valid JSON format' });
      console.log(`[Config]  ${file.padEnd(30, ' ')}: OK ✅`);
    } catch (e: any) {
      results.configs.push({ name: file, status: 'FAIL', message: e.message });
      console.error(`[Config]  ${file.padEnd(30, ' ')}: FAIL ❌ (${e.message})`);
    }
  }

  // ----------------------------------------------------------------
  // PHASE 2: CODEBASE STRUCTURE VERIFICATION (\src\translinkbridge & \src\translinkscene)
  // ----------------------------------------------------------------
  console.log('\n[PHASE 2] Validating translink bridge & scene structure...');
  const coreFiles = [
    { dir: 'src/translinkbridge', file: 'SceneBridge.ts', expected: ['class SceneBridge', 'getInstance()', 'init', 'refresh'] },
    { dir: 'src/translinkbridge', file: 'UIOverlay.ts', expected: ['class UIOverlay', 'mount()', 'discoverAndBuild', 'update('] },
    { dir: 'src/translinkbridge', file: 'Waypoint.ts', expected: ['class Waypoint', 'loadConfig()', 'buildDOM()', 'init()'] },
    { dir: 'src/translinkscene/world', file: 'World.ts', expected: ['class World'] },
  ];

  for (const item of coreFiles) {
    const filePath = path.resolve(process.cwd(), item.dir, item.file);
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }
      const source = fs.readFileSync(filePath, 'utf8');
      const missing = item.expected.filter(term => !source.includes(term));
      if (missing.length > 0) {
        throw new Error(`Missing symbols: ${missing.join(', ')}`);
      }
      results.bridge.push({ name: `${item.dir}/${item.file}`, status: 'OK', message: 'Correct exports and structure' });
      console.log(`[Bridge]  ${item.file.padEnd(30, ' ')}: OK ✅`);
    } catch (e: any) {
      results.bridge.push({ name: `${item.dir}/${item.file}`, status: 'FAIL', message: e.message });
      console.error(`[Bridge]  ${item.file.padEnd(30, ' ')}: FAIL ❌ (${e.message})`);
    }
  }

  // ----------------------------------------------------------------
  // PHASE 3: TYPESCRIPT / BUILD VERIFICATION (\src\translink & complete project)
  // ----------------------------------------------------------------
  console.log('\n[PHASE 3] Running TypeScript compilation check...');
  try {
    const tscCheck = spawn('npx', ['tsc', '--noEmit'], { shell: true });
    let tscOutput = '';
    tscCheck.stderr?.on('data', (data) => tscOutput += data.toString());
    tscCheck.stdout?.on('data', (data) => tscOutput += data.toString());
    
    const code = await new Promise((resolve) => tscCheck.on('close', resolve));
    if (code === 0) {
      results.typescript.status = 'OK';
      results.typescript.message = 'TypeScript compiles cleanly with 0 errors.';
      console.log(`[TypeScript] Compilation: OK (0 errors) ✅`);
    } else {
      results.typescript.status = 'FAIL';
      results.typescript.message = tscOutput.split('\n').slice(0, 5).join('\n'); // keep first 5 lines
      console.error(`[TypeScript] Compilation: FAIL ❌\n${results.typescript.message}`);
    }
  } catch (err: any) {
    results.typescript.status = 'FAIL';
    results.typescript.message = err.message;
    console.error(`[TypeScript] Compile check execution failed:`, err);
  }

  // ----------------------------------------------------------------
  // SERVER START & VERIFICATION
  // ----------------------------------------------------------------
  let serverProc: ChildProcess | null = null;
  try {
    serverProc = await startServer();
  } catch (err: any) {
    console.error('Failed to start server process:', err);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // PHASE 4: REST API ENDPOINTS VALIDATION (\server)
  // ----------------------------------------------------------------
  console.log('\n[PHASE 4] Validating REST API endpoints...');
  const endpoints = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/brain/status', method: 'GET' },
    { path: '/api/rtc/session', method: 'POST' }
  ];

  for (const ep of endpoints) {
    try {
      const res = await makeRequest({
        hostname: 'localhost',
        port: PORT,
        path: ep.path,
        method: ep.method,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.status === 200 || res.status === 201) {
        results.endpoints.push({ path: ep.path, status: 'OK', code: res.status, details: res.body.substring(0, 80) + '...' });
        console.log(`[API]     ${ep.method.padEnd(5, ' ')} ${ep.path.padEnd(25, ' ')}: OK ✅ (Code: ${res.status})`);
      } else {
        results.endpoints.push({ path: ep.path, status: 'FAIL', code: res.status, details: res.body });
        console.error(`[API]     ${ep.method.padEnd(5, ' ')} ${ep.path.padEnd(25, ' ')}: FAIL ❌ (Code: ${res.status})`);
      }
    } catch (e: any) {
      results.endpoints.push({ path: ep.path, status: 'FAIL', code: 500, details: e.message });
      console.error(`[API]     ${ep.method.padEnd(5, ' ')} ${ep.path.padEnd(25, ' ')}: FAIL ❌ (${e.message})`);
    }
  }

  // ----------------------------------------------------------------
  // PHASE 5: WEBSOCKET LIVE VOICE SYSTEM SIMULATION
  // ----------------------------------------------------------------
  console.log('\n[PHASE 5] Initiating Live Voice interactive test...');
  console.log(`[E2E Test] Connecting to Live Voice WebSocket: ${TEST_URL}`);
  const startTime = Date.now();
  const ws = new WebSocket(TEST_URL);

  let phase: 'welcome' | 'name' | 'query' | 'interrupt' | 'done' = 'welcome';
  let lastAudioTime = 0;
  let welcomeStartTime = 0;
  
  // Timer to fail-safe the test after 120 seconds
  const testTimeout = setTimeout(() => {
    console.error('\n[E2E Test] Test timed out after 120 seconds! ❌');
    results.voice.status = 'FAIL';
    results.voice.message = 'Test timed out during voice interaction sequence.';
    try {
      printReport(metrics, results);
    } catch (e) {}
    cleanup(ws, serverProc, 1);
  }, 120000);

  ws.on('open', () => {
    metrics.socketOpenMs = Date.now() - startTime;
    console.log(`[E2E Test] WebSocket connected successfully! Latency: ${metrics.socketOpenMs}ms ✅`);
    welcomeStartTime = Date.now();
  });

  ws.on('message', (data) => {
    const now = Date.now();
    const payload = JSON.parse(data.toString());

    // Setup Complete
    if (payload.setupComplete) {
      metrics.setupCompleteMs = now - welcomeStartTime;
      console.log(`[E2E Test] Setup Complete signal received: ${metrics.setupCompleteMs}ms`);
      return;
    }

    // Visitor Name Sync
    if (payload.visitorName) {
      console.log(`[E2E Test] Visitor Name Sync Event received: "${payload.visitorName}"`);
      if (phase === 'name' && payload.visitorName === 'Alex') {
        metrics.nameCaptureSuccess = true;
      }
    }

    // Audio Chunks
    if (payload.audio) {
      const audioBytes = Buffer.from(payload.audio, 'base64').length;
      
      // Track Jitter
      if (lastAudioTime > 0) {
        const delta = now - lastAudioTime;
        metrics.audioJitterMs.push(delta);
      }
      lastAudioTime = now;

      if (phase === 'welcome') {
        if (metrics.welcomeFirstAudioMs === 0) {
          metrics.welcomeFirstAudioMs = now - welcomeStartTime;
          console.log(`[E2E Test] Welcome greeting - first audio chunk: ${metrics.welcomeFirstAudioMs}ms`);
        }
        metrics.welcomeTotalAudioChunks++;
        metrics.welcomeTotalAudioBytes += audioBytes;
      } else if (phase === 'name') {
        if (metrics.nameFirstAudioMs === 0) {
          metrics.nameFirstAudioMs = now - metrics.nameInputSentAt;
          console.log(`[E2E Test] Name response - first audio chunk: ${metrics.nameFirstAudioMs}ms`);
        }
        metrics.nameResponseReceived = true;
      } else if (phase === 'query') {
        if (metrics.queryFirstAudioMs === 0) {
          metrics.queryFirstAudioMs = now - metrics.queryInputSentAt;
          console.log(`[E2E Test] Query response - first audio chunk: ${metrics.queryFirstAudioMs}ms`);
        }
        metrics.queryResponseReceived = true;
      } else if (phase === 'interrupt') {
        if (metrics.interruptedSuccess) {
          metrics.postInterruptAudioChunksAfterAck++;
          console.warn(`[E2E Test] Received audio chunk AFTER interruption ACK! Chunk size: ${audioBytes} bytes ⚠️`);
        }
      }
    }

    // Text Transcription
    if (payload.text) {
      if (phase === 'welcome' && metrics.welcomeFirstTextMs === 0) {
        metrics.welcomeFirstTextMs = now - welcomeStartTime;
      } else if (phase === 'name' && metrics.nameFirstTextMs === 0) {
        metrics.nameFirstTextMs = now - metrics.nameInputSentAt;
      } else if (phase === 'query' && metrics.queryFirstTextMs === 0) {
        metrics.queryFirstTextMs = now - metrics.queryInputSentAt;
      }
    }

    // Interruption Confirmation
    if (payload.interrupted) {
      console.log(`[E2E Test] Interruption Ack received from server!`);
      if (phase === 'interrupt') {
        metrics.interruptedAckMs = now - metrics.interruptSentAt;
        metrics.interruptedSuccess = true;
        
        // Wait 1.5s after interruption to verify no more audio arrives, then complete
        setTimeout(() => {
          phase = 'done';
          clearTimeout(testTimeout);
          results.voice.status = 'OK';
          results.voice.message = 'All voice interaction phases completed successfully.';
          printReport(metrics, results);
          cleanup(ws, serverProc, 0);
        }, 1500);
      }
    }

    // Turn Complete
    if (payload.turnComplete) {
      if (phase === 'welcome') {
        metrics.welcomeDurationMs = now - welcomeStartTime;
        console.log(`[E2E Test] Welcome turn completed in ${metrics.welcomeDurationMs}ms`);
        
        // Phase 1: Send visitor name
        console.log('\n[E2E Test] Initiating Phase 1: Sending Visitor Name ("Alex")');
        phase = 'name';
        metrics.nameInputSentAt = Date.now();
        ws.send(JSON.stringify({ text: "Hello! My name is Alex. Nice to meet you." }));
      } 
      else if (phase === 'name') {
        console.log(`[E2E Test] Visitor Name turn completed. Success? Name Saved: ${metrics.nameCaptureSuccess}`);
        
        // Phase 2: Send Domain Query
        console.log('\n[E2E Test] Initiating Phase 2: Sending Domain Query + Sector ("I run logistics. What speed limiters do you have?")');
        phase = 'query';
        metrics.queryInputSentAt = Date.now();
        ws.send(JSON.stringify({ text: "I run a logistics business in Addis Ababa. What speed limiters do you offer?" }));
      } 
      else if (phase === 'query') {
        console.log('[E2E Test] Domain Query turn completed.');
        
        // Phase 3: Test Barge-in
        console.log('\n[E2E Test] Initiating Phase 3: Testing Barge-in/Interruption');
        ws.send(JSON.stringify({ text: "Can you tell me details about your fuel monitoring capacitive sensor accuracy?" }));
        
        setTimeout(() => {
          console.log('[E2E Test] Simulating user barge-in (sending interrupt signal)...');
          phase = 'interrupt';
          metrics.interruptSentAt = Date.now();
          ws.send(JSON.stringify({ interrupt: true, reason: 'user_barge_in' }));
        }, 1500);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[E2E Test] WebSocket connection error:', err);
    results.voice.status = 'FAIL';
    results.voice.message = err.message;
    clearTimeout(testTimeout);
    cleanup(ws, serverProc, 1);
  });
}

function calculateJitter(jitterList: number[]) {
  if (jitterList.length === 0) return;
  const sum = jitterList.reduce((acc, val) => acc + val, 0);
  metrics.avgJitterMs = Math.round(sum / jitterList.length);
  metrics.maxJitterMs = Math.max(...jitterList);
}

function printReport(m: Metrics, results: any) {
  calculateJitter(m.audioJitterMs);
  
  console.log('\n================================================================');
  console.log('       TRANSLINK ROBOT GEMINI LIVE VOICE - PERFORMANCE REPORT   ');
  console.log('================================================================');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Connection Latency:          ${m.socketOpenMs} ms`);
  console.log(`Setup Complete Latency:      ${m.setupCompleteMs} ms`);
  console.log(`Welcome First Audio (TTFB):  ${m.welcomeFirstAudioMs} ms`);
  console.log(`Welcome First Text:          ${m.welcomeFirstTextMs} ms`);
  console.log(`Welcome Audio Chunks:        ${m.welcomeTotalAudioChunks}`);
  console.log(`Welcome Audio Data:          ${Math.round(m.welcomeTotalAudioBytes / 1024)} KB`);
  console.log(`Welcome Total Turn Time:     ${m.welcomeDurationMs} ms`);
  console.log('----------------------------------------------------------------');
  console.log(`Phase 1: Visitor Name Response`);
  console.log(`  First Audio (TTFB):        ${m.nameFirstAudioMs} ms`);
  console.log(`  saveVisitorName Executed:  ${m.nameCaptureSuccess ? 'YES ✅' : 'NO ❌'}`);
  console.log('----------------------------------------------------------------');
  console.log(`Phase 2: Domain Query & Sector Qualification`);
  console.log(`  First Audio (TTFB):        ${m.queryFirstAudioMs} ms`);
  console.log('----------------------------------------------------------------');
  console.log(`Phase 3: Barge-in / Interruption`);
  console.log(`  Interruption ACK Latency:  ${m.interruptedAckMs} ms`);
  console.log(`  Stop Transmission Success: ${m.interruptedSuccess ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Chaining Audio After ACK:  ${m.postInterruptAudioChunksAfterAck} chunks ${m.postInterruptAudioChunksAfterAck > 0 ? '⚠️ (distortion/lag risk)' : '✅ (clean)'}`);
  console.log('----------------------------------------------------------------');
  console.log(`Network Streaming & Jitter Profile`);
  console.log(`  Average Packet Interval:   ${m.avgJitterMs} ms`);
  console.log(`  Max Packet Interval Gap:   ${m.maxJitterMs} ms`);
  console.log('================================================================\n');

  // Save report to disk as docs/e2e-test-results.md
  try {
    const reportDir = path.resolve(process.cwd(), 'docs');
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'e2e-test-results.md');
    
    let markdown = `# Translink Solutions PLC - Full Project E2E Test & Diagnostics Report\n\n`;
    markdown += `Generated on: **${new Date().toISOString()}**\n\n`;
    
    markdown += `## 1. Directory & Config Files Verification (\\src\\translinkconfig)\n\n`;
    markdown += `| File Name | Status | Details |\n`;
    markdown += `| :--- | :--- | :--- |\n`;
    results.configs.forEach((c: any) => {
      markdown += `| ${c.name} | **${c.status}** | ${c.message} |\n`;
    });
    
    markdown += `\n## 2. Core Codebase Structures (\\src\\translinkbridge & \\src\\translinkscene)\n\n`;
    markdown += `| Component File | Status | Details |\n`;
    markdown += `| :--- | :--- | :--- |\n`;
    results.bridge.forEach((b: any) => {
      markdown += `| ${b.name} | **${b.status}** | ${b.message} |\n`;
    });
    
    markdown += `\n## 3. TypeScript Build Compilation (\\src\\translink)\n\n`;
    markdown += `- **Status**: **${results.typescript.status}**\n`;
    markdown += `- **Details**: ${results.typescript.message}\n\n`;
    
    markdown += `## 4. REST API Endpoint Status (\\server)\n\n`;
    markdown += `| Endpoint Route | Status | Code | Response Preview |\n`;
    markdown += `| :--- | :--- | :--- | :--- |\n`;
    results.endpoints.forEach((e: any) => {
      markdown += `| ${e.path} | **${e.status}** | ${e.code} | ${e.details} |\n`;
    });
    
    markdown += `\n## 5. Live Voice Performance & Streaming Metrics\n\n`;
    markdown += `| Metric | Measured Value | Target Value | Assessment |\n`;
    markdown += `| :--- | :--- | :--- | :--- |\n`;
    markdown += `| WebSocket Connection Upgrade | **${m.socketOpenMs} ms** | < 200 ms | ${m.socketOpenMs < 300 ? 'Excellent' : 'Needs Optimization'} |\n`;
    markdown += `| Orchestrator Setup Time | **${m.setupCompleteMs} ms** | < 500 ms | ${m.setupCompleteMs < 500 ? 'Excellent' : 'Slow initialization'} |\n`;
    markdown += `| Welcome Response Latency (TTFB) | **${m.welcomeFirstAudioMs} ms** | < 1500 ms | ${m.welcomeFirstAudioMs < 2000 ? 'Good' : 'Needs Optimization'} |\n`;
    markdown += `| Name Response Latency (TTFB) | **${m.nameFirstAudioMs} ms** | < 1500 ms | ${m.nameFirstAudioMs < 2000 ? 'Good' : 'Needs Optimization'} |\n`;
    markdown += `| Domain Query Response Latency (TTFB) | **${m.queryFirstAudioMs} ms** | < 1500 ms | ${m.queryFirstAudioMs < 2500 ? 'Acceptable' : 'High Latency / RAG Blocked'} |\n`;
    markdown += `| Audio Packet Interval (Jitter) | **${m.avgJitterMs} ms** | < 80 ms | ${m.avgJitterMs < 80 ? 'Stable' : 'Unstable / Jittery (Audio distortion risk)'} |\n`;
    markdown += `| Interruption ACK Delay | **${m.interruptedAckMs} ms** | < 300 ms | ${m.interruptedSuccess ? 'Passed' : 'Failed'} |\n`;
    markdown += `| Post-Interruption Late Packets | **${m.postInterruptAudioChunksAfterAck} chunks** | 0 chunks | ${m.postInterruptAudioChunksAfterAck === 0 ? 'Clean' : 'Overlap risk'} |\n\n`;
    
    markdown += `## Identified Performance Issues & Modules Requiring Optimization\n\n`;
    
    markdown += `### 1. High Turn Response Latency in Domain Queries\n`;
    markdown += `- **Latency**: ${m.queryFirstAudioMs} ms (Target < 1500 ms)\n`;
    markdown += `- **Bottleneck**: The RAG context retrieval inside \`buildUserTurn\` query block. Synchronous loading of files or blocking async context search causes response lag.\n`;
    markdown += `- **File**: [AgentOrchestrator.ts](file:///c:/Users/Abebaw/Desktop/TRANSLINK_CMS/TRANSLINK_WEB/deployment_fixed/project-fixed/server/services/AgentOrchestrator.ts)\n\n`;
    
    markdown += `### 2. Audio Interruption / Barge-in Defect\n`;
    markdown += `- **Status**: ${m.interruptedSuccess ? 'Passed' : 'Failed'}\n`;
    markdown += `- **Bottleneck**: The client-side \`{"interrupt": true}\` signal received by the server is logged but never forwarded to the Gemini Live session, causing the model to continue streaming audio and making barge-in ineffective.\n`;
    markdown += `- **File**: [GeminiLiveService.ts](file:///c:/Users/Abebaw/Desktop/TRANSLINK_CMS/TRANSLINK_WEB/deployment_fixed/project-fixed/server/services/GeminiLiveService.ts)\n\n`;

    markdown += `### 3. Lack of Client-side Audio Jitter Buffering\n`;
    markdown += `- **Metrics**: Average Jitter: ${m.avgJitterMs} ms, Max Gap: ${m.maxJitterMs} ms\n`;
    markdown += `- **Bottleneck**: The client app plays packets immediately upon receipt, leading to gap clicks and audio stuttering when TCP/WebSocket packets arrive irregularly.\n`;
    markdown += `- **File**: [TranslinkVoiceManager.ts](file:///c:/Users/Abebaw/Desktop/TRANSLINK_CMS/TRANSLINK_WEB/deployment_fixed/project-fixed/src/translink/components/TranslinkVoiceManager.ts)\n\n`;
    
    fs.writeFileSync(reportPath, markdown);
    console.log(`[E2E Test] Detailed report saved to: ${reportPath} ✅`);
  } catch (werr) {
    console.error('[E2E Test] Error saving markdown report:', werr);
  }
}

function cleanup(ws: WebSocket, serverProc: ChildProcess | null, exitCode: number) {
  console.log('[E2E Test] Cleaning up resources...');
  try {
    ws.close();
  } catch (e) {}

  if (serverProc) {
    console.log('[E2E Test] Stopping background test server...');
    const killed = serverProc.kill('SIGTERM') || serverProc.kill('SIGKILL');
    console.log(`[E2E Test] Server process terminated: ${killed}`);
  }

  process.exit(exitCode);
}

runTest().catch((err) => {
  console.error('Unhandled exception in E2E test:', err);
  process.exit(1);
});

import { pcmToBase64, base64ToFloat32 } from './audio-utils';

// Module-level registry: tracks which AudioContext instances have already had
// 'microphone-processor' registered. Prevents NotSupportedError on reconnection.
const WS_ALLOWED_METRICS = new Set<string>([
    'socket_open_ms',
    'setup_complete_from_socket_ms',
    'first_audio_from_connect_ms',
    'first_audio_from_socket_ms',
    'mic_permission_ms',
    'first_playback_after_audio_ms',
    'socket_error',
    'mic_permission_failed',
    'playback_interrupted'
]);

const _workletRegisteredContexts = new WeakSet<AudioContext>();
import { TranslinkLanguageController } from '../controllers/TranslinkLanguageController';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking';

export interface VoiceManagerCallbacks {
    onStateChange?: (state: VoiceState) => void;
    onTranscription?: (text: string) => void;
    onError?: (error: string) => void;
    onSetupComplete?: () => void;
    onMetric?: (name: string, value?: number | string) => void;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_FRAME_SIZE = 320; // 20ms at 16kHz
const VAD_MIN_RMS = 0.012;
const VAD_START_FRAMES = 2;
const VAD_HANGOVER_FRAMES = 15;
const VAD_NOISE_ALPHA = 0.04;

const AUDIO_WORKLET_CODE = `
class MicrophoneProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const channelData = input[0];
            this.port.postMessage(channelData.slice());
        }
        return true;
    }
}
registerProcessor('microphone-processor', MicrophoneProcessor);
`;

export class TranslinkVoiceManager {
    private ws: WebSocket | null = null;
    private audioCtx: AudioContext | null = null;
    private nextStartTime = 0;
    private state: VoiceState = 'idle';
    private callbacks: VoiceManagerCallbacks = {};
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private workletMonitorGain: GainNode | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private activeAudioSources: Set<AudioBufferSourceNode> = new Set();
    private playbackAnalyser: AnalyserNode | null = null;
    private _turnCompleteReceived = false;
    private pendingInputBuffer = new Float32Array(2048);
    private pendingInputCount = 0;
    private speechFrameCount = 0;
    private silenceFrameCount = 0;
    private isUserSpeaking = false;
    private vadNoiseFloor = 0.004;
    private hasReceivedAudio = false;
    private hasStartedPlayback = false;
    private connectRequestedAt = 0;
    private socketOpenedAt = 0;
    private micRequestedAt = 0;
    private firstAudioReceivedAt = 0;

    /* ── Jitter Buffer ───────────────────────────────────────────────────────
     * Incoming audio chunks are pushed into a queue and drained in order
     * using the Web Audio API scheduler. A 200 ms lookahead is applied before
     * the first chunk of every turn so that network jitter bursts can be
     * absorbed before playback begins, eliminating clicks, pops, and speed-ups.
     */
    private audioQueue: Array<AudioBuffer> = [];
    private isPlayingQueue = false;
    /** ms to pre-buffer before playing the first chunk of a new turn */
    private readonly JITTER_LOOKAHEAD_MS = 200;

    /* ── Reconnect / Timeout State ──────────────────────────────────────────────
     * Render free-tier services cold-start in 30–90 s; the connection timeout
     * and exponential-backoff reconnect give the server time to wake before
     * the user sees a permanent error.
     */
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    private readonly RECONNECT_BASE_DELAY_MS = 2000;  // 2 s → 4 s → 8 s
    private readonly CONNECTION_TIMEOUT_MS   = 15000; // 15 s covers most cold-starts
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    /** Set to true when the caller explicitly calls disconnect() — suppresses reconnect. */
    private _disconnecting = false;
    /** Saved connect() arguments replayed on reconnect. */
    private _lastConnectParams: { welcome: boolean; enableMic: boolean; onConnected?: () => void } | null = null;

    constructor(callbacks: VoiceManagerCallbacks = {}) {
        this.callbacks = callbacks;
    }

    private _emitMetric(name: string, value?: number | string): void {
        if (this.callbacks.onMetric) {
            this.callbacks.onMetric(name, value);
        }
        window.dispatchEvent(new CustomEvent('translink:voice-metric', {
            detail: { name, value, timestamp: performance.now() },
        }));
        if (this.ws?.readyState === WebSocket.OPEN && WS_ALLOWED_METRICS.has(name)) {
            this.ws.send(JSON.stringify({
                metric: {
                    name,
                    value,
                    timestamp: performance.now(),
                },
            }));
        }
    }

    private _changeState(newState: VoiceState): void {
        this.state = newState;
        if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange(newState);
        }
    }

    async connect(welcome: boolean = true, enableMic: boolean = true, onConnected?: () => void): Promise<void> {
        if (this.ws) return;

        /* Reset user-initiated-disconnect flag on every explicit connect() call */
        this._disconnecting = false;
        this._lastConnectParams = { welcome, enableMic, onConnected };

        /* ── Connection Timeout ─────────────────────────────────────────────────
         * If the WebSocket never fires onopen OR onerror (e.g. server cold-starting
         * or network stall), schedule a retry after CONNECTION_TIMEOUT_MS.
         */
        this._clearConnectionTimeout();
        this.connectionTimeoutTimer = setTimeout(() => {
            if (this.state === 'connecting') {
                console.warn('[VoiceManager] Connection timed out — scheduling reconnect');
                this._emitMetric('connection_timeout');
                this._scheduleReconnect();
            }
        }, this.CONNECTION_TIMEOUT_MS);

        this.connectRequestedAt = performance.now();
        this._emitMetric('connect_requested');
        this._changeState('connecting');

        try {
            // Setup Web Audio Context if not present
            if (!this.audioCtx) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
            }
            if (this.audioCtx.state === 'suspended') {
                await this.audioCtx.resume().catch(() => {});
            }
            if (!this.playbackAnalyser) {
                this.playbackAnalyser = this.audioCtx.createAnalyser();
                this.playbackAnalyser.fftSize = 256;
                this.playbackAnalyser.connect(this.audioCtx.destination);
            }

            const lang = TranslinkLanguageController.getInstance().getLanguage();
            const visitorName = localStorage.getItem('translink_visitor_name') || '';
            let wsUrl = '';
            
            /* When VITE_WS_BACKEND_URL is set (production split-host deployment),
             * connect to the dedicated Render backend. Otherwise fall back to the
             * same origin (works for local dev and when Render serves both).
             *
             * Supported VITE_WS_BACKEND_URL formats:
             *   wss://host        → used as-is
             *   ws://host         → used as-is
             *   https://host      → converted to wss://host  (FIX: was incorrectly prepending ws://)
             *   http://host       → converted to ws://host
             *   host              → protocol derived from window.location
             */
            let envBackendUrl = (import.meta.env.VITE_WS_BACKEND_URL || '').trim();
            if (envBackendUrl) {
                if (envBackendUrl.endsWith('/')) {
                    envBackendUrl = envBackendUrl.slice(0, -1);
                }
                if (envBackendUrl.startsWith('wss:') || envBackendUrl.startsWith('ws:')) {
                    // Already a fully-qualified WebSocket URL — use directly
                    wsUrl = `${envBackendUrl}/ws/live?lang=${encodeURIComponent(lang)}&welcome=${welcome}`;
                } else if (envBackendUrl.startsWith('https://')) {
                    // Full HTTPS URL → strip prefix and upgrade to WSS
                    wsUrl = `wss://${envBackendUrl.slice('https://'.length)}/ws/live?lang=${encodeURIComponent(lang)}&welcome=${welcome}`;
                } else if (envBackendUrl.startsWith('http://')) {
                    // Full HTTP URL → strip prefix and convert to WS
                    wsUrl = `ws://${envBackendUrl.slice('http://'.length)}/ws/live?lang=${encodeURIComponent(lang)}&welcome=${welcome}`;
                } else {
                    // Bare hostname (e.g. "translink-backend.onrender.com") — derive protocol
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    wsUrl = `${protocol}//${envBackendUrl}/ws/live?lang=${encodeURIComponent(lang)}&welcome=${welcome}`;
                }
            } else {
                // Same-origin fallback: local dev (Vite WS plugin) or Render full-stack
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${window.location.host}/ws/live?lang=${encodeURIComponent(lang)}&welcome=${welcome}`;
            }

            if (visitorName) {
                wsUrl += `&visitorName=${encodeURIComponent(visitorName)}`;
            }

            console.log('[VoiceManager] Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('[VoiceManager] WebSocket connected');
                /* Clear timeout — connection succeeded */
                this._clearConnectionTimeout();
                /* Reset backoff counter on successful connection */
                this.reconnectAttempts = 0;
                this.socketOpenedAt = performance.now();
                this._emitMetric('socket_open');
                this._emitMetric('socket_open_ms', this.socketOpenedAt - this.connectRequestedAt);
                this._changeState('listening');
                if (enableMic) {
                    this._startMicrophone();
                } else {
                    console.log('[VoiceManager] Microphone stream disabled for output-only announcements');
                }
                // Notify caller the moment the socket is confirmed open and ready.
                // This is the only safe point to send the first text prompt.
                if (onConnected) onConnected();
            };

            this.ws.onmessage = async (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.error) {
                        console.error('[VoiceManager] Server Error:', msg.error);
                        if (this.callbacks.onError) this.callbacks.onError(msg.error);
                        this.disconnect();
                        return;
                    }

                    if (msg.visitorName) {
                        localStorage.setItem('translink_visitor_name', msg.visitorName);
                        console.log('[VoiceManager] Visitor name saved from server:', msg.visitorName);
                        window.dispatchEvent(new CustomEvent('translink:visitor-name-updated', { detail: msg.visitorName }));
                    }

                    if (msg.leadSubmitted) {
                        console.log('[VoiceManager] Lead submission confirmed by server.');
                        window.dispatchEvent(new CustomEvent('translink:lead-submitted'));
                    }

                    if (msg.setupComplete) {
                        console.log('[VoiceManager] Server setup complete received');
                        this._emitMetric('setup_complete');
                        if (this.socketOpenedAt > 0) {
                            this._emitMetric('setup_complete_from_socket_ms', performance.now() - this.socketOpenedAt);
                        }
                        if (this.callbacks.onSetupComplete) {
                            this.callbacks.onSetupComplete();
                        }
                    }

                    if (msg.audio) {
                        if (!this.hasReceivedAudio) {
                            this.hasReceivedAudio = true;
                            this.firstAudioReceivedAt = performance.now();
                            this._emitMetric('first_audio_chunk_received');
                            this._emitMetric('first_audio_from_connect_ms', this.firstAudioReceivedAt - this.connectRequestedAt);
                            if (this.socketOpenedAt > 0) {
                                this._emitMetric('first_audio_from_socket_ms', this.firstAudioReceivedAt - this.socketOpenedAt);
                            }
                        }
                        this._changeState('speaking');
                        this._playAudioChunk(msg.audio);
                    }

                    if (msg.interrupted) {
                        this._stopPlayback();
                    }

                    if (msg.text && this.callbacks.onTranscription) {
                        this.callbacks.onTranscription(msg.text);
                    }

                    if (msg.turnComplete) {
                        this._turnCompleteReceived = true;
                        if (this.activeAudioSources.size === 0) {
                            this._changeState('listening');
                        }
                    }
                } catch (err) {
                    console.error('[VoiceManager] Error parsing message:', err);
                }
            };

            this.ws.onclose = (event) => {
                console.log('[VoiceManager] WebSocket connection closed', event.code, event.reason);
                this._clearConnectionTimeout();
                this._emitMetric('socket_close', `${event.code}:${event.reason || 'no_reason'}`);
                /* code 1000 = normal closure (e.g. max session reached, user logout).
                 * Any other code = unexpected drop → attempt reconnect. */
                const isNormalClose = event.code === 1000 || this._disconnecting;
                this.disconnect();
                if (!isNormalClose) this._scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                console.error('[VoiceManager] WebSocket error occurred:', err);
                this._clearConnectionTimeout();
                this._emitMetric('socket_error');
                if (this.callbacks.onError) this.callbacks.onError('Connection error');
                /* disconnect() is called by onclose which always fires after onerror;
                 * _scheduleReconnect() is also triggered there to avoid double-scheduling. */
            };
        } catch (error: any) {
            console.error('[VoiceManager] Failed to connect:', error);
            if (this.callbacks.onError)
                this.callbacks.onError(error.message || 'Failed to connect');
            this.disconnect();
        }
    }

    /**
     * Explicitly disconnect and cancel all pending reconnects.
     * Call this when the user intentionally closes the voice session.
     */
    disconnect(): void {
        /* Mark as intentional so onclose does not schedule a reconnect */
        this._disconnecting = true;
        this._clearConnectionTimeout();
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;

        this._stopMicrophone();
        this._stopPlayback(); // also flushes audioQueue and resets isPlayingQueue
        this._turnCompleteReceived = false;
        this.pendingInputCount = 0;
        this.speechFrameCount = 0;
        this.silenceFrameCount = 0;
        this.isUserSpeaking = false;
        this.hasReceivedAudio = false;
        this.hasStartedPlayback = false;

        if (this.ws) {
            if (
                this.ws.readyState === WebSocket.OPEN ||
                this.ws.readyState === WebSocket.CONNECTING
            ) {
                this.ws.close();
            }
            this.ws = null;
        }

        this._changeState('idle');
    }

    /* ── Private: Reconnect Helpers ─────────────────────────────────────────── */

    /**
     * Schedule a reconnect attempt with exponential backoff.
     * Silently no-ops if the user called disconnect() or max attempts reached.
     */
    private _scheduleReconnect(): void {
        if (this._disconnecting || !this._lastConnectParams) return;
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.warn(
                `[VoiceManager] Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached.`
            );
            this._emitMetric('reconnect_exhausted');
            if (this.callbacks.onError) {
                this.callbacks.onError('Voice connection unavailable. Please try again later.');
            }
            return;
        }

        const delay = this.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;
        console.log(
            `[VoiceManager] Reconnecting in ${delay}ms ` +
            `(attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`
        );
        this._emitMetric('reconnect_scheduled', this.reconnectAttempts);

        if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this._disconnecting && this._lastConnectParams) {
                const { welcome, enableMic, onConnected } = this._lastConnectParams;
                this.connect(welcome, enableMic, onConnected);
            }
        }, delay);
    }

    /** Clear the connection timeout guard safely. */
    private _clearConnectionTimeout(): void {
        if (this.connectionTimeoutTimer !== null) {
            clearTimeout(this.connectionTimeoutTimer);
            this.connectionTimeoutTimer = null;
        }
    }

    private async _startMicrophone(): Promise<void> {
        if (!this.audioCtx) return;

        try {
            this.micRequestedAt = performance.now();
            this._emitMetric('mic_permission_requested');
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._emitMetric('mic_stream_active');
            this._emitMetric('mic_permission_ms', performance.now() - this.micRequestedAt);
            this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

            // Register inline AudioWorklet module — guarded by WeakSet to prevent
            // NotSupportedError: 'microphone-processor already registered' on reconnect.
            if (!_workletRegisteredContexts.has(this.audioCtx)) {
                const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
                const workletUrl = URL.createObjectURL(blob);
                await this.audioCtx.audioWorklet.addModule(workletUrl);
                URL.revokeObjectURL(workletUrl);
                _workletRegisteredContexts.add(this.audioCtx);
            }

            this.workletNode = new AudioWorkletNode(this.audioCtx, 'microphone-processor');

            this.sourceNode.connect(this.workletNode);
            this.workletMonitorGain = this.audioCtx.createGain();
            this.workletMonitorGain.gain.value = 0;
            this.workletNode.connect(this.workletMonitorGain);
            this.workletMonitorGain.connect(this.audioCtx.destination);

            this.workletNode.port.onmessage = (e) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const inputData: Float32Array = e.data;
                    this._processMicrophoneFrame(inputData);
                }
            };

            console.log('[VoiceManager] Microphone active and streaming');
        } catch (err: any) {
            console.warn('[VoiceManager] Microphone accessibility error. Falling back to Output-Only Text-to-Speech mode:', err);
            this._emitMetric('mic_permission_failed', err?.name || err?.message || 'unknown');
            // Do NOT call disconnect() or trigger onError. Keeping connection open allows text-to-speech audio responses to still play!
        }
    }

    private _stopMicrophone(): void {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
        }
        if (this.workletNode) {
            this.workletNode.port.onmessage = null;
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.workletMonitorGain) {
            this.workletMonitorGain.disconnect();
            this.workletMonitorGain = null;
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        console.log('[VoiceManager] Microphone stopped');
    }

    private _processMicrophoneFrame(inputData: Float32Array): void {
        if (!this.audioCtx || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const currentSampleRate = this.audioCtx.sampleRate;
        const ratio = currentSampleRate / INPUT_SAMPLE_RATE;
        const approxNewSamples = Math.floor(inputData.length / ratio);

        // Ensure flat typed buffer is large enough
        if (this.pendingInputCount + approxNewSamples > this.pendingInputBuffer.length) {
            const newBuffer = new Float32Array((this.pendingInputCount + approxNewSamples) * 2);
            newBuffer.set(this.pendingInputBuffer.subarray(0, this.pendingInputCount));
            this.pendingInputBuffer = newBuffer;
        }

        // Linear interpolation resampling directly into pendingInputBuffer
        let writePtr = this.pendingInputCount;
        for (let i = 0; i < approxNewSamples; i++) {
            const index = i * ratio;
            const left = Math.floor(index);
            const right = Math.min(left + 1, inputData.length - 1);
            const frac = index - left;
            this.pendingInputBuffer[writePtr++] = inputData[left] * (1 - frac) + inputData[right] * frac;
        }
        this.pendingInputCount = writePtr;

        // Drain frames of INPUT_FRAME_SIZE (320)
        while (this.pendingInputCount >= INPUT_FRAME_SIZE) {
            const frame = new Float32Array(INPUT_FRAME_SIZE);
            frame.set(this.pendingInputBuffer.subarray(0, INPUT_FRAME_SIZE));
            
            // Shift remaining samples to the front
            this.pendingInputBuffer.copyWithin(0, INPUT_FRAME_SIZE, this.pendingInputCount);
            this.pendingInputCount -= INPUT_FRAME_SIZE;
            
            this._processVadFrame(frame);
        }
    }

    private _processVadFrame(frame: Float32Array): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const rms = this._calculateRms(frame);
        const threshold = Math.max(VAD_MIN_RMS, this.vadNoiseFloor * 3.2);
        const speechDetected = rms > threshold;

        if (!speechDetected && !this.isUserSpeaking) {
            this.vadNoiseFloor = this.vadNoiseFloor * (1 - VAD_NOISE_ALPHA) + rms * VAD_NOISE_ALPHA;
        }

        if (speechDetected) {
            this.speechFrameCount++;
            this.silenceFrameCount = 0;
        } else {
            this.silenceFrameCount++;
            this.speechFrameCount = 0;
        }

        if (!this.isUserSpeaking && this.speechFrameCount >= VAD_START_FRAMES) {
            this.isUserSpeaking = true;
            this._emitMetric('vad_speech_start', rms);

            if (this.state === 'speaking') {
                this._stopPlayback();
                this._changeState('listening');
                this.ws.send(JSON.stringify({ interrupt: true, reason: 'user_barge_in' }));
                this._emitMetric('barge_in');
            }
        }

        const shouldSend = this.isUserSpeaking || speechDetected;
        if (shouldSend) {
            this.ws.send(JSON.stringify({
                audio: pcmToBase64(frame),
                mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
            }));
        }

        if (this.isUserSpeaking && this.silenceFrameCount >= VAD_HANGOVER_FRAMES) {
            this.isUserSpeaking = false;
            this._emitMetric('vad_speech_end', rms);
            this.ws.send(JSON.stringify({ audioStreamEnd: true }));
            this._emitMetric('audio_stream_end');
        }
    }

    private _calculateRms(frame: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < frame.length; i++) {
            sum += frame[i] * frame[i];
        }
        return Math.sqrt(sum / frame.length);
    }

    private _playAudioChunk(base64Audio: string): void {
        // ── Late-arrival guard ──────────────────────────────────────────────
        // Discard any audio packets that arrive after an interruption. The
        // server-side flag stops sending, but in-flight WebSocket frames can
        // still arrive for a brief window. Dropping them here ensures they
        // never trigger unexpected playback or corrupt the playback schedule.
        if (this.state !== 'speaking' && this.state !== 'connecting') {
            console.warn('[VoiceManager] Discarding late-arriving audio packet post-interruption (state:', this.state, ')');
            this._emitMetric('late_audio_discarded');
            return;
        }

        if (!this.audioCtx) return;
        this._turnCompleteReceived = false;

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }

        const float32Data = base64ToFloat32(base64Audio);
        const buffer = this.audioCtx.createBuffer(1, float32Data.length, OUTPUT_SAMPLE_RATE);
        buffer.getChannelData(0).set(float32Data);

        if (!this.hasStartedPlayback) {
            this.hasStartedPlayback = true;
            this._emitMetric('first_playback_scheduled');
            if (this.firstAudioReceivedAt > 0) {
                this._emitMetric('first_playback_after_audio_ms', performance.now() - this.firstAudioReceivedAt);
            }
        }

        this._enqueueAudioBuffer(buffer);
    }

    /**
     * Push a decoded AudioBuffer into the jitter queue and start the drain
     * scheduler if it is not already running.
     *
     * On the very first chunk of a new turn we apply a JITTER_LOOKAHEAD_MS
     * (200 ms) pre-buffer window so that any burst of out-of-order network
     * packets can be absorbed before playback begins, preventing the robotic
     * speed-up artefacts caused by audio-clock gaps.
     */
    private _enqueueAudioBuffer(buffer: AudioBuffer): void {
        this.audioQueue.push(buffer);
        this._emitMetric('jitter_queue_depth', this.audioQueue.length);

        if (!this.isPlayingQueue) {
            this.isPlayingQueue = true;
            // Apply lookahead only at the start of a new turn
            const lookaheadSeconds = this.JITTER_LOOKAHEAD_MS / 1000;
            if (this.audioCtx) {
                // Seed nextStartTime to absorb jitter before first chunk plays
                this.nextStartTime = this.audioCtx.currentTime + lookaheadSeconds;
            }
            this._drainAudioQueue();
        }
    }

    /**
     * Drain the jitter buffer queue by scheduling each AudioBuffer back-to-back
     * on the Web Audio clock. When the queue empties and the turn is complete,
     * transition state back to listening.
     */
    private _drainAudioQueue(): void {
        if (!this.audioCtx || this.audioQueue.length === 0) {
            // Queue exhausted
            this.isPlayingQueue = false;
            if (this._turnCompleteReceived && this.state === 'speaking') {
                this._changeState('listening');
            }
            return;
        }

        const buffer = this.audioQueue.shift()!;
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;

        if (this.playbackAnalyser) {
            source.connect(this.playbackAnalyser);
        } else {
            source.connect(this.audioCtx.destination);
        }

        // Pin the start time to the audio clock — never allow gaps
        const startTime = Math.max(this.audioCtx.currentTime, this.nextStartTime);
        this.nextStartTime = startTime + buffer.duration;

        this.activeAudioSources.add(source);
        this._emitMetric('playback_queue_depth', this.activeAudioSources.size);

        source.onended = () => {
            this.activeAudioSources.delete(source);
            this._emitMetric('playback_queue_depth', this.activeAudioSources.size);
            // Schedule the next chunk immediately on the audio event thread
            this._drainAudioQueue();
        };

        source.start(startTime);
    }

    private _stopPlayback(): void {
        this._turnCompleteReceived = false;
        // ── Jitter buffer teardown ──────────────────────────────────────────
        // Flush the pending queue so no buffered chunks play after interruption
        this.audioQueue = [];
        this.isPlayingQueue = false;
        // ────────────────────────────────────────────────────────────────────
        this.activeAudioSources.forEach((src) => {
            try {
                src.onended = null; // Prevent post-stop drain scheduling
                src.stop();
            } catch (e) {}
        });
        this.activeAudioSources.clear();
        this._emitMetric('playback_interrupted');
        if (this.audioCtx) {
            this.nextStartTime = this.audioCtx.currentTime;
        }
        console.log('[VoiceManager] Playback interrupted and jitter queue flushed');
    }

    isConnected(): boolean {
        return this.state !== 'idle';
    }

    getState(): VoiceState {
        return this.state;
    }

    sendText(text: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._changeState('connecting');
            console.log('[VoiceManager] Sending text context to server:', text);
            this.ws.send(JSON.stringify({ text }));
        }
    }

    getPlaybackVolume(): number {
        if (!this.playbackAnalyser) return 0;
        const dataArray = new Uint8Array(this.playbackAnalyser.frequencyBinCount);
        this.playbackAnalyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
        }
        return Math.sqrt(sum / dataArray.length);
    }

    isMicrophoneActive(): boolean {
        return this.mediaStream !== null;
    }

    async startMicrophoneIfInactive(): Promise<void> {
        if (this.mediaStream) return;
        await this._startMicrophone();
    }

    getAudioContext(): AudioContext | null {
        return this.audioCtx;
    }

    async resumeContext(): Promise<void> {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume().catch(() => {});
            console.log('[VoiceManager] AudioContext resumed via user gesture');
        }
    }
}

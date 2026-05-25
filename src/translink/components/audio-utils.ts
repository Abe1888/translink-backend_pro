/**
 * Converts Float32Array PCM data to Base64 encoded Int16 PCM data for Gemini Live API.
 */
/**
 * Converts Float32Array PCM data to Base64 encoded Int16 PCM data for Gemini Live API.
 */
export function pcmToBase64(float32Array: Float32Array): string {
    const len = float32Array.length;
    const int16Array = new Int16Array(len);
    for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(int16Array.buffer);
    
    // Fast conversion: chunking to prevent stack overflow while avoiding character-by-character allocation
    const chunkLimit = 4096;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkLimit) {
        const chunk = bytes.subarray(i, i + chunkLimit);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
}

/**
 * Converts Base64 encoded Int16 PCM data to Float32Array for Web Audio API.
 */
export function base64ToFloat32(base64: string): Float32Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, len / 2);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
}

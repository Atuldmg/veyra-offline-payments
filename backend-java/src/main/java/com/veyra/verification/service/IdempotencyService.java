package com.veyra.verification.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * High-performance, concurrent, in-memory idempotency deduplication cache.
 * Uses atomic compare-and-set semantics (putIfAbsent) on the SHA-256 ciphertext hash.
 * Prevents race conditions and double-spending when multiple bridge nodes simultaneously
 * attempt to ingest duplicate mesh packets.
 */
@Service
public class IdempotencyService {

    private final Map<String, Instant> seenHashes = new ConcurrentHashMap<>();

    @Value("${veyra.idempotency.ttl-seconds:86400}")
    private long ttlSeconds;

    /**
     * Attempts to atomically claim a packet hash.
     * @param packetHash SHA-256 hex string of packet ciphertext.
     * @return true if caller is the first to claim; false if duplicate.
     */
    public boolean claim(String packetHash) {
        Instant now = Instant.now();
        Instant existing = seenHashes.putIfAbsent(packetHash, now);
        return existing == null;
    }

    /**
     * Checks if a packet hash was previously seen without claiming.
     */
    public boolean isSeen(String packetHash) {
        return seenHashes.containsKey(packetHash);
    }

    public int size() {
        return seenHashes.size();
    }

    /**
     * Evicts expired cache records past TTL window.
     */
    @Scheduled(fixedDelay = 60_000)
    public void evictExpired() {
        Instant cutoff = Instant.now().minusSeconds(ttlSeconds);
        seenHashes.entrySet().removeIf(e -> e.getValue().isBefore(cutoff));
    }

    public void clear() {
        seenHashes.clear();
    }
}

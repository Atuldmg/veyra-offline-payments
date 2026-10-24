package com.veyra.verification.service;

import com.veyra.verification.crypto.HybridCryptoService;
import com.veyra.verification.dto.VerificationRequest;
import com.veyra.verification.dto.VerificationResult;
import com.veyra.verification.model.PaymentInstruction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Core protocol verification service for VEYRA.
 * Performs cryptographic verification, idempotency gatekeeping, and freshness checks.
 */
@Service
public class VerificationService {

    private static final Logger log = LoggerFactory.getLogger(VerificationService.class);

    @Autowired
    private HybridCryptoService crypto;

    @Autowired
    private IdempotencyService idempotency;

    @Value("${veyra.packet.max-age-seconds:86400}")
    private long maxAgeSeconds;

    public VerificationResult verifyPacket(VerificationRequest req) {
        String packetHash = "?";
        try {
            packetHash = crypto.hashCiphertext(req.getCiphertext());

            // 1. Idempotency Check
            if (!idempotency.claim(packetHash)) {
                log.info("Idempotency match: Duplicate packet {} from bridge {} dropped",
                        packetHash.substring(0, Math.min(12, packetHash.length())), req.getBridgeNodeId());
                return VerificationResult.duplicate(packetHash, req.getBridgeNodeId());
            }

            // 2. Cryptographic Envelope Decryption & AES-GCM Tag Verification
            PaymentInstruction instruction;
            try {
                instruction = crypto.decrypt(req.getCiphertext());
            } catch (Exception e) {
                log.warn("Cryptographic verification failed for packet {}: {}",
                        packetHash.substring(0, Math.min(12, packetHash.length())), e.getMessage());
                return VerificationResult.invalid(packetHash, "Cryptographic decryption or authentication tag check failed: " + e.getMessage(), req.getBridgeNodeId());
            }

            // 3. Freshness Check (Anti-Replay)
            long nowMs = Instant.now().toEpochMilli();
            long signedAt = instruction.getSignedAt() != null ? instruction.getSignedAt() : 0L;
            long ageSeconds = (nowMs - signedAt) / 1000;

            if (ageSeconds > maxAgeSeconds) {
                log.warn("Stale packet rejected. Age: {}s (allowed: {}s)", ageSeconds, maxAgeSeconds);
                return VerificationResult.invalid(packetHash, "Stale packet timestamp exceeds allowed window", req.getBridgeNodeId());
            }

            if (ageSeconds < -300) {
                log.warn("Packet timestamp in future beyond clock-skew threshold. SignedAt: {}", signedAt);
                return VerificationResult.invalid(packetHash, "Packet signedAt timestamp is in the future", req.getBridgeNodeId());
            }

            log.info("Verification SUCCESS: packet {} (sender={}, amount=₹{}, bridge={}, hops={})",
                    packetHash.substring(0, Math.min(12, packetHash.length())),
                    instruction.getSenderVpa(), instruction.getAmount(), req.getBridgeNodeId(), req.getHopCount());

            return VerificationResult.verified(packetHash, instruction, req.getBridgeNodeId(), req.getHopCount());

        } catch (Exception e) {
            log.error("Unexpected verification error for packet {}: {}", packetHash, e.getMessage(), e);
            return VerificationResult.invalid(packetHash, "Internal verification error: " + e.getMessage(), req.getBridgeNodeId());
        }
    }
}

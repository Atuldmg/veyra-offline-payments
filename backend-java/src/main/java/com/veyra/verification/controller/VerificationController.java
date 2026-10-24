package com.veyra.verification.controller;

import com.veyra.verification.crypto.HybridCryptoService;
import com.veyra.verification.crypto.ServerKeyHolder;
import com.veyra.verification.dto.CreatePacketRequest;
import com.veyra.verification.dto.VerificationRequest;
import com.veyra.verification.dto.VerificationResult;
import com.veyra.verification.model.MeshPacket;
import com.veyra.verification.model.PaymentInstruction;
import com.veyra.verification.service.VerificationService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class VerificationController {

    @Autowired
    private VerificationService verificationService;

    @Autowired
    private HybridCryptoService cryptoService;

    @Autowired
    private ServerKeyHolder serverKeyHolder;

    /**
     * Public endpoint to fetch server's RSA-2048 public key for client encryption.
     */
    @GetMapping("/crypto/public-key")
    public ResponseEntity<Map<String, String>> getPublicKey() {
        return ResponseEntity.ok(Map.of(
                "brand", "VEYRA",
                "tagline", "Secure Transactions. Resilient Networks.",
                "algorithm", "RSA-2048 / OAEP-SHA256",
                "hybridScheme", "RSA-OAEP envelopes an ephemeral AES-256-GCM symmetric session key",
                "publicKey", serverKeyHolder.getPublicKeyBase64()
        ));
    }

    /**
     * Internal server-to-server endpoint for verifying and decrypting a transaction packet.
     * Authenticated via SecurityFilter (X-Veyra-Internal-Key).
     */
    @PostMapping("/verify")
    public ResponseEntity<VerificationResult> verifyPacket(@Valid @RequestBody VerificationRequest req) {
        VerificationResult result = verificationService.verifyPacket(req);
        return ResponseEntity.ok(result);
    }

    /**
     * Internal helper endpoint to simulate phone-side canonical payload creation and encryption.
     */
    @PostMapping("/crypto/encrypt")
    public ResponseEntity<Map<String, Object>> encryptPayload(@RequestBody CreatePacketRequest req) throws Exception {
        String nonce = req.getNonce() != null ? req.getNonce() : UUID.randomUUID().toString();
        long signedAt = Instant.now().toEpochMilli();

        // Compute simulated PIN hash
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        byte[] pinBytes = sha.digest((req.getPin() != null ? req.getPin() : "1234").getBytes(StandardCharsets.UTF_8));
        StringBuilder pinHex = new StringBuilder();
        for (byte b : pinBytes) {
            pinHex.append(String.format("%02x", b));
        }

        PaymentInstruction instruction = new PaymentInstruction(
                req.getSenderVpa(),
                req.getReceiverVpa(),
                req.getAmount(),
                pinHex.toString(),
                nonce,
                signedAt
        );

        String ciphertext = cryptoService.encrypt(instruction, serverKeyHolder.getPublicKey());
        String packetId = UUID.randomUUID().toString();
        int ttl = req.getTtl() != null ? req.getTtl() : 5;

        MeshPacket packet = new MeshPacket(packetId, ttl, signedAt, ciphertext);
        String packetHash = cryptoService.hashCiphertext(ciphertext);

        return ResponseEntity.ok(Map.of(
                "packetId", packetId,
                "packetHash", packetHash,
                "ttl", ttl,
                "createdAt", signedAt,
                "nonce", nonce,
                "ciphertext", ciphertext,
                "startDevice", req.getStartDevice() != null ? req.getStartDevice() : "phone-alice"
        ));
    }
}

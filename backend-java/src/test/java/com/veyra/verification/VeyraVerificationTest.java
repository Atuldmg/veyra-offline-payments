package com.veyra.verification;

import com.veyra.verification.crypto.HybridCryptoService;
import com.veyra.verification.crypto.ServerKeyHolder;
import com.veyra.verification.dto.VerificationRequest;
import com.veyra.verification.dto.VerificationResult;
import com.veyra.verification.model.PaymentInstruction;
import com.veyra.verification.service.IdempotencyService;
import com.veyra.verification.service.VerificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class VeyraVerificationTest {

    @Autowired
    private HybridCryptoService crypto;

    @Autowired
    private ServerKeyHolder serverKey;

    @Autowired
    private VerificationService verificationService;

    @Autowired
    private IdempotencyService idempotency;

    @BeforeEach
    void setup() {
        idempotency.clear();
    }

    @Test
    void testEncryptDecryptRoundTrip() throws Exception {
        PaymentInstruction original = new PaymentInstruction(
                "alice@veyra", "bob@veyra", new BigDecimal("750.50"),
                "pin-hash-1234", UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ciphertext = crypto.encrypt(original, serverKey.getPublicKey());
        assertNotNull(ciphertext);

        PaymentInstruction decrypted = crypto.decrypt(ciphertext);
        assertEquals("alice@veyra", decrypted.getSenderVpa());
        assertEquals("bob@veyra", decrypted.getReceiverVpa());
        assertEquals(new BigDecimal("750.50"), decrypted.getAmount());
        assertEquals(original.getNonce(), decrypted.getNonce());
    }

    @Test
    void testTamperedCiphertextIsRejected() throws Exception {
        PaymentInstruction original = new PaymentInstruction(
                "alice@veyra", "bob@veyra", new BigDecimal("100.00"),
                "pin-hash", UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String validCiphertext = crypto.encrypt(original, serverKey.getPublicKey());
        byte[] bytes = Base64.getDecoder().decode(validCiphertext);

        // Perturb the last byte (inside the AES-GCM tag)
        bytes[bytes.length - 1] ^= 0x55;
        String tamperedCiphertext = Base64.getEncoder().encodeToString(bytes);

        VerificationRequest req = new VerificationRequest(
                UUID.randomUUID().toString(), tamperedCiphertext, 5, System.currentTimeMillis(), "phone-bridge", 1
        );

        VerificationResult res = verificationService.verifyPacket(req);
        assertEquals("INVALID", res.getOutcome());
        assertNotNull(res.getReason());
    }

    @Test
    void testConcurrentBridgeDeduplication() throws Exception {
        PaymentInstruction original = new PaymentInstruction(
                "alice@veyra", "bob@veyra", new BigDecimal("500.00"),
                "pin-hash", UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ciphertext = crypto.encrypt(original, serverKey.getPublicKey());
        String packetId = UUID.randomUUID().toString();

        int threadCount = 3;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startGate = new CountDownLatch(1);
        CountDownLatch endGate = new CountDownLatch(threadCount);

        List<VerificationResult> results = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            final int bridgeIdx = i;
            pool.submit(() -> {
                try {
                    startGate.await();
                    VerificationRequest req = new VerificationRequest(
                            packetId, ciphertext, 4, System.currentTimeMillis(), "bridge-gateway-" + bridgeIdx, 2
                    );
                    results.add(verificationService.verifyPacket(req));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    endGate.countDown();
                }
            });
        }

        // Fire all threads simultaneously
        startGate.countDown();
        assertTrue(endGate.await(5, TimeUnit.SECONDS));
        pool.shutdown();

        long verifiedCount = results.stream().filter(r -> "VERIFIED".equals(r.getOutcome())).count();
        long duplicateCount = results.stream().filter(r -> "DUPLICATE_DROPPED".equals(r.getOutcome())).count();

        assertEquals(1, verifiedCount, "Exactly one delivery must be VERIFIED");
        assertEquals(2, duplicateCount, "Exactly two deliveries must be DUPLICATE_DROPPED");
    }
}

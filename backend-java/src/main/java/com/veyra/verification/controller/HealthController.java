package com.veyra.verification.controller;

import com.veyra.verification.crypto.ServerKeyHolder;
import com.veyra.verification.service.IdempotencyService;
import com.veyra.verification.service.MeshSimulatorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    private final long startTime = System.currentTimeMillis();

    @Autowired
    private ServerKeyHolder serverKeyHolder;

    @Autowired
    private IdempotencyService idempotencyService;

    @Autowired
    private MeshSimulatorService meshSimulatorService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        long uptimeSeconds = (System.currentTimeMillis() - startTime) / 1000;
        Runtime rt = Runtime.getRuntime();

        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "VEYRA-Verification-Microservice",
                "brand", "VEYRA",
                "tagline", "Secure Transactions. Resilient Networks.",
                "version", "1.0.0-PROTOTYPE",
                "uptimeSeconds", uptimeSeconds,
                "jvmVersion", System.getProperty("java.version"),
                "memoryFreeMb", rt.freeMemory() / (1024 * 1024),
                "memoryTotalMb", rt.totalMemory() / (1024 * 1024),
                "keyFingerprint", serverKeyHolder.getPublicKeyBase64().substring(0, 32) + "...",
                "idempotencyCacheEntries", idempotencyService.size(),
                "meshVirtualNodes", meshSimulatorService.getDevices().size()
        ));
    }
}

package com.veyra.verification.controller;

import com.veyra.verification.crypto.ServerKeyHolder;
import com.veyra.verification.service.IdempotencyService;
import com.veyra.verification.service.MeshSimulatorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
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

        Map<String, Object> map = new LinkedHashMap<>();
        map.put("status", "UP");
        map.put("service", "VEYRA-Verification-Microservice");
        map.put("brand", "VEYRA");
        map.put("tagline", "Secure Transactions. Resilient Networks.");
        map.put("version", "1.0.0-PROTOTYPE");
        map.put("uptimeSeconds", uptimeSeconds);
        map.put("jvmVersion", System.getProperty("java.version"));
        map.put("memoryFreeMb", rt.freeMemory() / (1024 * 1024));
        map.put("memoryTotalMb", rt.totalMemory() / (1024 * 1024));
        map.put("keyFingerprint", serverKeyHolder.getPublicKeyBase64().substring(0, 32) + "...");
        map.put("idempotencyCacheEntries", idempotencyService.size());
        map.put("meshVirtualNodes", meshSimulatorService.getDevices().size());

        return ResponseEntity.ok(map);
    }
}

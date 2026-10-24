package com.veyra.verification.controller;

import com.veyra.verification.model.MeshPacket;
import com.veyra.verification.model.VirtualDevice;
import com.veyra.verification.service.IdempotencyService;
import com.veyra.verification.service.MeshSimulatorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/mesh")
public class MeshSimulatorController {

    @Autowired
    private MeshSimulatorService meshSimulatorService;

    @Autowired
    private IdempotencyService idempotencyService;

    @GetMapping("/state")
    public ResponseEntity<Map<String, Object>> getMeshState() {
        List<Map<String, Object>> deviceList = new ArrayList<>();
        for (VirtualDevice device : meshSimulatorService.getDevices()) {
            List<String> packetSummaries = device.getHeldPackets().stream()
                    .map(p -> p.getPacketId().substring(0, Math.min(8, p.getPacketId().length())))
                    .toList();

            deviceList.add(Map.of(
                    "deviceId", device.getDeviceId(),
                    "hasInternet", device.hasInternet(),
                    "packetCount", device.packetCount(),
                    "packetIds", packetSummaries
            ));
        }

        return ResponseEntity.ok(Map.of(
                "devices", deviceList,
                "idempotencyCacheSize", idempotencyService.size()
        ));
    }

    @PostMapping("/inject")
    public ResponseEntity<Map<String, Object>> injectPacket(@RequestBody Map<String, Object> body) {
        String deviceId = (String) body.getOrDefault("deviceId", "phone-alice");
        String packetId = (String) body.get("packetId");
        int ttl = body.get("ttl") != null ? ((Number) body.get("ttl")).intValue() : 5;
        Long createdAt = body.get("createdAt") != null ? ((Number) body.get("createdAt")).longValue() : System.currentTimeMillis();
        String ciphertext = (String) body.get("ciphertext");

        MeshPacket packet = new MeshPacket(packetId, ttl, createdAt, ciphertext);
        meshSimulatorService.inject(deviceId, packet);

        return ResponseEntity.ok(Map.of(
                "status", "INJECTED",
                "deviceId", deviceId,
                "packetId", packetId,
                "ttl", ttl
        ));
    }

    @PostMapping("/gossip")
    public ResponseEntity<Map<String, Object>> runGossipRound() {
        MeshSimulatorService.GossipResult result = meshSimulatorService.gossipOnce();
        return ResponseEntity.ok(Map.of(
                "transfers", result.transfers(),
                "deviceCounts", result.deviceCounts()
        ));
    }

    @PostMapping("/flush")
    public ResponseEntity<Map<String, Object>> flushBridgeUploads() {
        List<MeshSimulatorService.BridgeUpload> uploads = meshSimulatorService.collectBridgeUploads();
        List<Map<String, Object>> uploadList = new ArrayList<>();

        for (MeshSimulatorService.BridgeUpload up : uploads) {
            uploadList.add(Map.of(
                    "bridgeNodeId", up.bridgeNodeId(),
                    "packetId", up.packet().getPacketId(),
                    "ttl", up.packet().getTtl(),
                    "createdAt", up.packet().getCreatedAt(),
                    "ciphertext", up.packet().getCiphertext(),
                    "hopCount", Math.max(0, 5 - up.packet().getTtl())
            ));
        }

        return ResponseEntity.ok(Map.of(
                "pendingUploads", uploadList.size(),
                "uploads", uploadList
        ));
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetMesh() {
        meshSimulatorService.resetMesh();
        idempotencyService.clear();
        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Mesh state and idempotency cache successfully cleared"
        ));
    }
}

package com.veyra.verification.service;

import com.veyra.verification.model.MeshPacket;
import com.veyra.verification.model.VirtualDevice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simulates peer-to-peer mesh packet gossip and opportunistic bridge uploads.
 */
@Service
public class MeshSimulatorService {

    private static final Logger log = LoggerFactory.getLogger(MeshSimulatorService.class);

    private final Map<String, VirtualDevice> devices = new ConcurrentHashMap<>();

    public MeshSimulatorService() {
        seedDefaultTopology();
    }

    public void seedDefaultTopology() {
        devices.clear();
        devices.put("phone-alice", new VirtualDevice("phone-alice", false));
        devices.put("phone-bob", new VirtualDevice("phone-bob", false));
        devices.put("phone-carol", new VirtualDevice("phone-carol", false));
        devices.put("phone-dave", new VirtualDevice("phone-dave", false));
        devices.put("phone-bridge", new VirtualDevice("phone-bridge", true));
    }

    public Collection<VirtualDevice> getDevices() {
        return devices.values();
    }

    public VirtualDevice getDevice(String id) {
        return devices.get(id);
    }

    public void inject(String senderDeviceId, MeshPacket packet) {
        VirtualDevice sender = devices.get(senderDeviceId);
        if (sender == null) {
            throw new IllegalArgumentException("Unknown virtual device: " + senderDeviceId);
        }
        sender.hold(packet);
        log.info("Packet {} injected into node {} (TTL={})",
                packet.getPacketId().substring(0, Math.min(8, packet.getPacketId().length())),
                senderDeviceId, packet.getTtl());
    }

    public GossipResult gossipOnce() {
        int transfers = 0;
        List<VirtualDevice> deviceList = new ArrayList<>(devices.values());

        // Snapshot existing held packets before propagating in this round
        Map<String, List<MeshPacket>> snapshot = new HashMap<>();
        for (VirtualDevice d : deviceList) {
            snapshot.put(d.getDeviceId(), new ArrayList<>(d.getHeldPackets()));
        }

        for (VirtualDevice src : deviceList) {
            for (MeshPacket pkt : snapshot.get(src.getDeviceId())) {
                if (pkt.getTtl() <= 0) continue;
                for (VirtualDevice dst : deviceList) {
                    if (dst == src) continue;
                    if (dst.holds(pkt.getPacketId())) continue;

                    MeshPacket propagated = new MeshPacket(
                            pkt.getPacketId(),
                            pkt.getTtl() - 1,
                            pkt.getCreatedAt(),
                            pkt.getCiphertext()
                    );
                    dst.hold(propagated);
                    transfers++;
                }
            }
        }

        log.info("Mesh gossip round completed with {} packet transfers", transfers);
        return new GossipResult(transfers, snapshotCounts());
    }

    public Map<String, Integer> snapshotCounts() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (VirtualDevice d : devices.values()) {
            counts.put(d.getDeviceId(), d.packetCount());
        }
        return counts;
    }

    public List<BridgeUpload> collectBridgeUploads() {
        List<BridgeUpload> uploads = new ArrayList<>();
        for (VirtualDevice d : devices.values()) {
            if (!d.hasInternet()) continue;
            for (MeshPacket pkt : d.getHeldPackets()) {
                uploads.add(new BridgeUpload(d.getDeviceId(), pkt));
            }
        }
        return uploads;
    }

    public void resetMesh() {
        devices.values().forEach(VirtualDevice::clear);
    }

    public record GossipResult(int transfers, Map<String, Integer> deviceCounts) {}
    public record BridgeUpload(String bridgeNodeId, MeshPacket packet) {}
}

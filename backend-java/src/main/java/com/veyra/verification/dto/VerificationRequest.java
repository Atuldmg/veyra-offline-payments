package com.veyra.verification.dto;

import jakarta.validation.constraints.NotBlank;

public class VerificationRequest {

    private String packetId;

    @NotBlank(message = "Ciphertext is required for verification")
    private String ciphertext;

    private int ttl = 5;
    private Long createdAt;
    private String bridgeNodeId = "unknown";
    private int hopCount = 0;

    public VerificationRequest() {}

    public VerificationRequest(String packetId, String ciphertext, int ttl, Long createdAt, String bridgeNodeId, int hopCount) {
        this.packetId = packetId;
        this.ciphertext = ciphertext;
        this.ttl = ttl;
        this.createdAt = createdAt;
        this.bridgeNodeId = bridgeNodeId;
        this.hopCount = hopCount;
    }

    public String getPacketId() { return packetId; }
    public void setPacketId(String packetId) { this.packetId = packetId; }

    public String getCiphertext() { return ciphertext; }
    public void setCiphertext(String ciphertext) { this.ciphertext = ciphertext; }

    public int getTtl() { return ttl; }
    public void setTtl(int ttl) { this.ttl = ttl; }

    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }

    public String getBridgeNodeId() { return bridgeNodeId; }
    public void setBridgeNodeId(String bridgeNodeId) { this.bridgeNodeId = bridgeNodeId; }

    public int getHopCount() { return hopCount; }
    public void setHopCount(int hopCount) { this.hopCount = hopCount; }
}

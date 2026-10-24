package com.veyra.verification.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * VEYRA Wire Format Mesh Packet.
 * Outer metadata is inspectable by intermediate nodes for routing and TTL decay.
 * Ciphertext is cryptographically opaque and protected by AES-GCM + RSA-OAEP.
 */
public class MeshPacket {

    @NotBlank
    private String packetId;

    @Min(0)
    private int ttl;

    @NotNull
    private Long createdAt;

    @NotBlank
    private String ciphertext;

    public MeshPacket() {}

    public MeshPacket(String packetId, int ttl, Long createdAt, String ciphertext) {
        this.packetId = packetId;
        this.ttl = ttl;
        this.createdAt = createdAt;
        this.ciphertext = ciphertext;
    }

    public String getPacketId() { return packetId; }
    public void setPacketId(String packetId) { this.packetId = packetId; }

    public int getTtl() { return ttl; }
    public void setTtl(int ttl) { this.ttl = ttl; }

    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }

    public String getCiphertext() { return ciphertext; }
    public void setCiphertext(String ciphertext) { this.ciphertext = ciphertext; }
}

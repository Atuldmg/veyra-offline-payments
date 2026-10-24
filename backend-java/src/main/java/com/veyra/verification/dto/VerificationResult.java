package com.veyra.verification.dto;

import com.veyra.verification.model.PaymentInstruction;

public class VerificationResult {

    private String outcome; // VERIFIED, DUPLICATE_DROPPED, INVALID
    private String packetHash;
    private String reason;
    private PaymentInstruction instruction;
    private Long verifiedAt;
    private String bridgeNodeId;
    private int hopCount;

    public VerificationResult() {}

    public VerificationResult(String outcome, String packetHash, String reason,
                              PaymentInstruction instruction, Long verifiedAt,
                              String bridgeNodeId, int hopCount) {
        this.outcome = outcome;
        this.packetHash = packetHash;
        this.reason = reason;
        this.instruction = instruction;
        this.verifiedAt = verifiedAt;
        this.bridgeNodeId = bridgeNodeId;
        this.hopCount = hopCount;
    }

    public static VerificationResult verified(String hash, PaymentInstruction instruction, String bridgeNodeId, int hopCount) {
        return new VerificationResult("VERIFIED", hash, null, instruction, System.currentTimeMillis(), bridgeNodeId, hopCount);
    }

    public static VerificationResult duplicate(String hash, String bridgeNodeId) {
        return new VerificationResult("DUPLICATE_DROPPED", hash, "Packet hash already processed in current idempotency window", null, System.currentTimeMillis(), bridgeNodeId, 0);
    }

    public static VerificationResult invalid(String hash, String reason, String bridgeNodeId) {
        return new VerificationResult("INVALID", hash, reason, null, System.currentTimeMillis(), bridgeNodeId, 0);
    }

    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }

    public String getPacketHash() { return packetHash; }
    public void setPacketHash(String packetHash) { this.packetHash = packetHash; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public PaymentInstruction getInstruction() { return instruction; }
    public void setInstruction(PaymentInstruction instruction) { this.instruction = instruction; }

    public Long getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(Long verifiedAt) { this.verifiedAt = verifiedAt; }

    public String getBridgeNodeId() { return bridgeNodeId; }
    public void setBridgeNodeId(String bridgeNodeId) { this.bridgeNodeId = bridgeNodeId; }

    public int getHopCount() { return hopCount; }
    public void setHopCount(int hopCount) { this.hopCount = hopCount; }
}

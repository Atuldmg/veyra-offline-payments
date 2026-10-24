package com.veyra.verification.dto;

import java.math.BigDecimal;

public class CreatePacketRequest {

    private String senderVpa;
    private String receiverVpa;
    private BigDecimal amount;
    private String pin;
    private String nonce;
    private Integer ttl = 5;
    private String startDevice = "phone-alice";

    public CreatePacketRequest() {}

    public String getSenderVpa() { return senderVpa; }
    public void setSenderVpa(String senderVpa) { this.senderVpa = senderVpa; }

    public String getReceiverVpa() { return receiverVpa; }
    public void setReceiverVpa(String receiverVpa) { this.receiverVpa = receiverVpa; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }

    public String getNonce() { return nonce; }
    public void setNonce(String nonce) { this.nonce = nonce; }

    public Integer getTtl() { return ttl; }
    public void setTtl(Integer ttl) { this.ttl = ttl; }

    public String getStartDevice() { return startDevice; }
    public void setStartDevice(String startDevice) { this.startDevice = startDevice; }
}

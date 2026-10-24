package com.veyra.verification.crypto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.veyra.verification.model.PaymentInstruction;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;

/**
 * Hybrid encryption engine for VEYRA.
 *
 * Pattern:
 * 1. Generate an ephemeral AES-256 symmetric key per transaction.
 * 2. Encrypt the payload using AES-256-GCM (authenticated encryption with 128-bit authentication tag).
 * 3. Encrypt the AES key using RSA-2048 with OAEP (SHA-256 + MGF1).
 * 4. Concatenate: [256-byte RSA wrapped key][12-byte GCM IV][AES ciphertext + 16-byte GCM tag].
 *
 * Tamper Resistance:
 * Any single-bit perturbation of the ciphertext or IV causes GCM tag verification
 * to fail with an AEADBadTagException, preventing processing of forged or altered packets.
 */
@Service
public class HybridCryptoService {

    private static final String RSA_TRANSFORMATION = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";
    private static final String AES_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int AES_KEY_BITS = 256;
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final int RSA_ENCRYPTED_KEY_BYTES = 256; // 2048-bit RSA

    private final SecureRandom rng = new SecureRandom();
    private final ObjectMapper json = new ObjectMapper();

    @Autowired
    private ServerKeyHolder serverKey;

    /**
     * Encrypts a payment instruction using the server's public key.
     */
    public String encrypt(PaymentInstruction instruction, PublicKey serverPublicKey) throws Exception {
        byte[] plaintext = json.writeValueAsBytes(instruction);

        // 1. Generate fresh AES-256 key
        KeyGenerator kg = KeyGenerator.getInstance("AES");
        kg.init(AES_KEY_BITS);
        SecretKey aesKey = kg.generateKey();

        // 2. AES-GCM encryption
        byte[] iv = new byte[GCM_IV_BYTES];
        rng.nextBytes(iv);
        Cipher aes = Cipher.getInstance(AES_TRANSFORMATION);
        aes.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] aesCiphertext = aes.doFinal(plaintext);

        // 3. RSA-OAEP wrap AES key
        Cipher rsa = Cipher.getInstance(RSA_TRANSFORMATION);
        OAEPParameterSpec oaep = new OAEPParameterSpec(
                "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT);
        rsa.init(Cipher.ENCRYPT_MODE, serverPublicKey, oaep);
        byte[] encryptedAesKey = rsa.doFinal(aesKey.getEncoded());

        // 4. Pack envelope
        ByteBuffer buf = ByteBuffer.allocate(encryptedAesKey.length + iv.length + aesCiphertext.length);
        buf.put(encryptedAesKey);
        buf.put(iv);
        buf.put(aesCiphertext);

        return Base64.getEncoder().encodeToString(buf.array());
    }

    /**
     * Decrypts and verifies the ciphertext with the server's private key.
     */
    public PaymentInstruction decrypt(String base64Ciphertext) throws Exception {
        byte[] all = Base64.getDecoder().decode(base64Ciphertext);

        if (all.length < RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES + GCM_TAG_BITS / 8) {
            throw new IllegalArgumentException("Malformed ciphertext: payload shorter than cryptographic header minimum");
        }

        byte[] encryptedAesKey = new byte[RSA_ENCRYPTED_KEY_BYTES];
        byte[] iv = new byte[GCM_IV_BYTES];
        byte[] aesCiphertext = new byte[all.length - RSA_ENCRYPTED_KEY_BYTES - GCM_IV_BYTES];

        ByteBuffer buf = ByteBuffer.wrap(all);
        buf.get(encryptedAesKey);
        buf.get(iv);
        buf.get(aesCiphertext);

        // 1. Unwrap AES key using RSA-OAEP private key
        Cipher rsa = Cipher.getInstance(RSA_TRANSFORMATION);
        OAEPParameterSpec oaep = new OAEPParameterSpec(
                "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT);
        rsa.init(Cipher.DECRYPT_MODE, serverKey.getPrivateKey(), oaep);
        byte[] aesKeyBytes = rsa.doFinal(encryptedAesKey);
        SecretKey aesKey = new SecretKeySpec(aesKeyBytes, "AES");

        // 2. AES-GCM decrypt and verify tag
        Cipher aes = Cipher.getInstance(AES_TRANSFORMATION);
        aes.init(Cipher.DECRYPT_MODE, aesKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] plaintext = aes.doFinal(aesCiphertext);

        return json.readValue(plaintext, PaymentInstruction.class);
    }

    /**
     * Computes the SHA-256 hash of the base64 ciphertext.
     * Used as the zero-cost idempotency key prior to decryption.
     */
    public String hashCiphertext(String base64Ciphertext) throws Exception {
        MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
        byte[] hash = sha256.digest(base64Ciphertext.getBytes());
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }
}

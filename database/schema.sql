-- VEYRA — MySQL Database Schema & Seed Data
-- Brand: VEYRA (Secure Transactions. Resilient Networks.)
-- Target: MySQL 8.0 / MariaDB 10.4+

CREATE DATABASE IF NOT EXISTS `veyra_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `veyra_db`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `pin_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Accounts / Wallets Table
CREATE TABLE IF NOT EXISTS `accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `vpa` VARCHAR(100) NOT NULL UNIQUE,
    `account_number` VARCHAR(30) NOT NULL UNIQUE,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'FROZEN') NOT NULL DEFAULT 'ACTIVE',
    `version` INT NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Transactions Table (Canonical Ledger)
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `transaction_reference` VARCHAR(64) NOT NULL UNIQUE,
    `sender_account_id` INT NOT NULL,
    `receiver_account_id` INT NOT NULL,
    `sender_vpa` VARCHAR(100) NOT NULL,
    `receiver_vpa` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('CREATED', 'PENDING_VERIFICATION', 'QUEUED_FOR_SYNC', 'SYNCHRONIZED', 'REJECTED', 'FAILED') NOT NULL DEFAULT 'CREATED',
    `packet_id` VARCHAR(64) NULL,
    `packet_hash` VARCHAR(64) NOT NULL UNIQUE,
    `nonce` VARCHAR(64) NOT NULL,
    `hop_count` INT NOT NULL DEFAULT 0,
    `bridge_node_id` VARCHAR(50) NULL,
    `failure_reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `settled_at` TIMESTAMP NULL,
    INDEX `idx_tx_status` (`status`),
    INDEX `idx_tx_sender` (`sender_vpa`),
    INDEX `idx_tx_receiver` (`receiver_vpa`),
    FOREIGN KEY (`sender_account_id`) REFERENCES `accounts`(`id`),
    FOREIGN KEY (`receiver_account_id`) REFERENCES `accounts`(`id`)
) ENGINE=InnoDB;

-- 4. Transaction Status History (Append-Only Audit)
CREATE TABLE IF NOT EXISTS `transaction_status_history` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `transaction_id` BIGINT NOT NULL,
    `from_status` VARCHAR(30) NULL,
    `to_status` VARCHAR(30) NOT NULL,
    `changed_by` VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Idempotency Records (Pre-decryption Gatekeeper)
CREATE TABLE IF NOT EXISTS `idempotency_records` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `packet_hash` VARCHAR(64) NOT NULL UNIQUE,
    `first_bridge_node` VARCHAR(50) NOT NULL,
    `claim_status` ENUM('CLAIMED', 'SETTLED', 'DROPPED_DUPLICATE', 'EXPIRED') NOT NULL DEFAULT 'CLAIMED',
    `transaction_id` BIGINT NULL,
    `claimed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_idempotency_hash` (`packet_hash`)
) ENGINE=InnoDB;

-- 6. Offline Message Queue (Store-and-Forward Outbox Vault)
CREATE TABLE IF NOT EXISTS `offline_queue` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `packet_id` VARCHAR(64) NOT NULL UNIQUE,
    `packet_hash` VARCHAR(64) NOT NULL,
    `sender_vpa` VARCHAR(100) NOT NULL,
    `receiver_vpa` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `ciphertext` TEXT NOT NULL,
    `ttl` INT NOT NULL DEFAULT 5,
    `current_holder_node` VARCHAR(50) NOT NULL DEFAULT 'phone-alice',
    `status` ENUM('QUEUED', 'IN_FLIGHT', 'INGESTED', 'EXPIRED') NOT NULL DEFAULT 'QUEUED',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_queue_status` (`status`)
) ENGINE=InnoDB;

-- 7. Virtual Mesh Peer Nodes Registry
CREATE TABLE IF NOT EXISTS `mesh_nodes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `node_id` VARCHAR(50) NOT NULL UNIQUE,
    `label` VARCHAR(100) NOT NULL,
    `has_internet` BOOLEAN NOT NULL DEFAULT FALSE,
    `is_bridge` BOOLEAN NOT NULL DEFAULT FALSE,
    `battery_level` INT NOT NULL DEFAULT 100,
    `status` ENUM('ONLINE', 'OFFLINE', 'RELAYING') NOT NULL DEFAULT 'ONLINE',
    `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 8. Tamper-Evident System Audit Events
CREATE TABLE IF NOT EXISTS `audit_events` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_type` VARCHAR(50) NOT NULL,
    `actor` VARCHAR(50) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    `details` JSON NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_type` (`event_type`)
) ENGINE=InnoDB;

-- SEED DATA (Synthetic Demo Wallets & Virtual Nodes)
INSERT INTO `users` (`id`, `username`, `full_name`, `email`, `pin_hash`) VALUES
(1, 'alice', 'Alice Sharma', 'alice@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V'),
(2, 'bob', 'Bob Patel', 'bob@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V'),
(3, 'carol', 'Carol Verma', 'carol@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V'),
(4, 'dave', 'Dave Rao', 'dave@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V')
ON DUPLICATE KEY UPDATE `full_name`=VALUES(`full_name`);

INSERT INTO `accounts` (`id`, `user_id`, `vpa`, `account_number`, `balance`, `currency`, `status`, `version`) VALUES
(1, 1, 'alice@demo', 'VEYRA-ACC-1001', 5000.00, 'INR', 'ACTIVE', 0),
(2, 2, 'bob@demo', 'VEYRA-ACC-1002', 1000.00, 'INR', 'ACTIVE', 0),
(3, 3, 'carol@demo', 'VEYRA-ACC-1003', 2500.00, 'INR', 'ACTIVE', 0),
(4, 4, 'dave@demo', 'VEYRA-ACC-1004', 500.00, 'INR', 'ACTIVE', 0)
ON DUPLICATE KEY UPDATE `balance`=VALUES(`balance`);

INSERT INTO `mesh_nodes` (`id`, `node_id`, `label`, `has_internet`, `is_bridge`, `battery_level`, `status`) VALUES
(1, 'phone-alice', 'Alice (Origin Sender)', FALSE, FALSE, 94, 'ONLINE'),
(2, 'phone-stranger1', 'Stranger 1 (Relay)', FALSE, FALSE, 82, 'ONLINE'),
(3, 'phone-stranger2', 'Stranger 2 (Relay)', FALSE, FALSE, 76, 'ONLINE'),
(4, 'phone-stranger3', 'Stranger 3 (Relay)', FALSE, FALSE, 68, 'ONLINE'),
(5, 'phone-bridge', 'Bridge Node (4G Uplink Gateway)', TRUE, TRUE, 98, 'ONLINE')
ON DUPLICATE KEY UPDATE `status`=VALUES(`status`);

INSERT INTO `audit_events` (`event_type`, `actor`, `ip_address`, `details`) VALUES
('SYSTEM_INITIALIZATION', 'GATEWAY_ORCHESTRATOR', '127.0.0.1', JSON_OBJECT('status', 'SUCCESS', 'version', '1.0.0-PROTOTYPE', 'environment', 'production_local'));

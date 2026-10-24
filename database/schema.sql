-- VEYRA — Secure Transactions. Resilient Networks.
-- Master Database Schema (MySQL 8.0+ / MariaDB compatible)
-- Character Set: utf8mb4, Collation: utf8mb4_unicode_ci

CREATE DATABASE IF NOT EXISTS `veyra_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `veyra_db`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `audit_events`;
DROP TABLE IF EXISTS `offline_queue`;
DROP TABLE IF EXISTS `idempotency_records`;
DROP TABLE IF EXISTS `transaction_status_history`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `mesh_nodes`;
DROP TABLE IF EXISTS `accounts`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Demo Participants / Users
CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `pin_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Demo Accounts / Wallets
CREATE TABLE `accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `vpa` VARCHAR(100) NOT NULL UNIQUE,
    `account_number` VARCHAR(30) NOT NULL UNIQUE,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `status` ENUM('ACTIVE', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `version` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    INDEX `idx_accounts_vpa` (`vpa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Mesh Simulation Nodes
CREATE TABLE `mesh_nodes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `node_id` VARCHAR(50) NOT NULL UNIQUE,
    `label` VARCHAR(100) NOT NULL,
    `has_internet` BOOLEAN NOT NULL DEFAULT FALSE,
    `is_bridge` BOOLEAN NOT NULL DEFAULT FALSE,
    `battery_level` INT NOT NULL DEFAULT 100,
    `status` ENUM('ONLINE', 'OFFLINE', 'SYNCING') NOT NULL DEFAULT 'ONLINE',
    `last_seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Authoritative Transaction Ledger
CREATE TABLE `transactions` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `transaction_reference` VARCHAR(64) NOT NULL UNIQUE,
    `sender_account_id` INT NOT NULL,
    `receiver_account_id` INT NOT NULL,
    `sender_vpa` VARCHAR(100) NOT NULL,
    `receiver_vpa` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM(
        'CREATED',
        'PENDING_VERIFICATION',
        'VERIFIED',
        'QUEUED_FOR_SYNC',
        'SYNCHRONIZED',
        'REJECTED',
        'FAILED'
    ) NOT NULL DEFAULT 'CREATED',
    `packet_id` VARCHAR(64) NULL,
    `packet_hash` VARCHAR(64) NOT NULL UNIQUE,
    `nonce` VARCHAR(64) NOT NULL,
    `hop_count` INT NOT NULL DEFAULT 0,
    `bridge_node_id` VARCHAR(50) NULL,
    `failure_reason` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `settled_at` TIMESTAMP NULL,
    CONSTRAINT `fk_tx_sender` FOREIGN KEY (`sender_account_id`) REFERENCES `accounts` (`id`),
    CONSTRAINT `fk_tx_receiver` FOREIGN KEY (`receiver_account_id`) REFERENCES `accounts` (`id`),
    INDEX `idx_tx_status` (`status`),
    INDEX `idx_tx_hash` (`packet_hash`),
    INDEX `idx_tx_sender_vpa` (`sender_vpa`),
    INDEX `idx_tx_receiver_vpa` (`receiver_vpa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Transaction Status Auditable State Transitions
CREATE TABLE `transaction_status_history` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `transaction_id` BIGINT NOT NULL,
    `from_status` VARCHAR(30) NULL,
    `to_status` VARCHAR(30) NOT NULL,
    `changed_by` VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_tsh_tx` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE,
    INDEX `idx_tsh_tx` (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Idempotency Records (Database-tier duplicate protection)
CREATE TABLE `idempotency_records` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `packet_hash` VARCHAR(64) NOT NULL UNIQUE,
    `first_seen_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `first_bridge_node` VARCHAR(50) NOT NULL,
    `claim_status` ENUM('IN_PROGRESS', 'SETTLED', 'DROPPED_DUPLICATE', 'INVALID') NOT NULL DEFAULT 'IN_PROGRESS',
    `transaction_id` BIGINT NULL,
    CONSTRAINT `fk_idem_tx` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL,
    INDEX `idx_idem_hash` (`packet_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Offline Message Queue (Pending bridge ingestion)
CREATE TABLE `offline_queue` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `packet_id` VARCHAR(64) NOT NULL UNIQUE,
    `packet_hash` VARCHAR(64) NOT NULL,
    `sender_vpa` VARCHAR(100) NOT NULL,
    `receiver_vpa` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `ciphertext` MEDIUMTEXT NOT NULL,
    `ttl` INT NOT NULL DEFAULT 5,
    `current_holder_node` VARCHAR(50) NOT NULL DEFAULT 'phone-alice',
    `status` ENUM('QUEUED', 'IN_FLIGHT', 'INGESTED', 'DROPPED_EXPIRED') NOT NULL DEFAULT 'QUEUED',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_queue_holder` (`current_holder_node`),
    INDEX `idx_queue_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Immutable Security & Operational Audit Log
CREATE TABLE `audit_events` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `event_type` VARCHAR(50) NOT NULL,
    `actor` VARCHAR(50) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `details` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_type` (`event_type`),
    INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

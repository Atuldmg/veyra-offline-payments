-- VEYRA — Seed Data for Demo & Prototype Testing
-- NOTICE: All records below are purely synthetic for testing and academic demonstration.
-- No real money, bank accounts, or external payment networks are referenced.

USE `veyra_db`;

-- 1. Insert Demo Users (PIN: 1234 for all demo accounts for testing convenience)
-- Hash generated via standard SHA-256 for reproducible demo verification
INSERT INTO `users` (`id`, `username`, `full_name`, `email`, `pin_hash`) VALUES
(1, 'alice', 'Alice Sharma', 'alice@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V'),
(2, 'bob', 'Bob Patel', 'bob@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V'),
(3, 'carol', 'Carol Verma', 'carol@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V'),
(4, 'dave', 'Dave Rao', 'dave@veyra.local', '$2y$10$eA8m9Z1eA7u0Gf7p1Q0V..dM0pXoW5A8s1Z0m9Z1eA7u0Gf7p1Q0V')
ON DUPLICATE KEY UPDATE `full_name`=VALUES(`full_name`);

-- 2. Insert Demo Accounts
INSERT INTO `accounts` (`id`, `user_id`, `vpa`, `account_number`, `balance`, `currency`, `status`, `version`) VALUES
(1, 1, 'alice@veyra', 'VEYRA-ACC-1001', 10000.00, 'INR', 'ACTIVE', 0),
(2, 2, 'bob@veyra', 'VEYRA-ACC-1002', 2500.00, 'INR', 'ACTIVE', 0),
(3, 3, 'carol@veyra', 'VEYRA-ACC-1003', 5000.00, 'INR', 'ACTIVE', 0),
(4, 4, 'dave@veyra', 'VEYRA-ACC-1004', 1500.00, 'INR', 'ACTIVE', 0)
ON DUPLICATE KEY UPDATE `balance`=VALUES(`balance`);

-- 3. Insert Mesh Simulation Nodes
INSERT INTO `mesh_nodes` (`id`, `node_id`, `label`, `has_internet`, `is_bridge`, `battery_level`, `status`) VALUES
(1, 'phone-alice', 'Alice Phone (Sender)', FALSE, FALSE, 92, 'ONLINE'),
(2, 'phone-bob', 'Bob Phone (Relay)', FALSE, FALSE, 78, 'ONLINE'),
(3, 'phone-carol', 'Carol Phone (Relay)', FALSE, FALSE, 85, 'ONLINE'),
(4, 'phone-dave', 'Dave Phone (Relay)', FALSE, FALSE, 64, 'ONLINE'),
(5, 'phone-bridge', 'Bridge Gateway (4G Uplink)', TRUE, TRUE, 99, 'ONLINE')
ON DUPLICATE KEY UPDATE `status`=VALUES(`status`);

-- 4. Initial Audit Log Entry
INSERT INTO `audit_events` (`event_type`, `actor`, `ip_address`, `details`) VALUES
('SYSTEM_INITIALIZATION', 'SYSTEM_MIGRATION', '127.0.0.1', JSON_OBJECT('status', 'SUCCESS', 'version', '1.0.0-PROTOTYPE', 'environment', 'local_sandbox'));

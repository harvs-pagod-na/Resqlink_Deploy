-- =============================================================================
-- RESQLINK - Emergency Communication & Response System Database Schema
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Pampanga Towns Master Table
CREATE TABLE IF NOT EXISTS `pampanga_towns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `town_name` VARCHAR(100) NOT NULL UNIQUE,
  `zip_code` VARCHAR(10),
  `latitude` DECIMAL(10, 8) DEFAULT 15.0343,
  `longitude` DECIMAL(11, 8) DEFAULT 120.6843,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_town_name` (`town_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Pampanga Barangays Table
CREATE TABLE IF NOT EXISTS `pampanga_barangays` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `town_id` INT NOT NULL,
  `barangay_name` VARCHAR(100) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_brgy_town` FOREIGN KEY (`town_id`) REFERENCES `pampanga_towns`(`id`) ON DELETE CASCADE,
  INDEX `idx_town_brgy` (`town_id`, `barangay_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` CHAR(36) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone_number` VARCHAR(20),
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'admin', 'sub_admin', 'user', 'responder', 'pnp_responder', 'bfp_responder', 'mdrrmo_admin') NOT NULL DEFAULT 'user',
  `is_verified` TINYINT(1) DEFAULT 0,
  `verification_status` ENUM('unverified', 'pending_ai', 'pending_admin', 'verified', 'approved', 'rejected') DEFAULT 'unverified',
  `is_active` TINYINT(1) DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_status` (`verification_status`, `role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. User Profiles Table
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `full_name` VARCHAR(255),
  `avatar_url` VARCHAR(255),
  `headline` VARCHAR(255),
  `bio` TEXT,
  `pampanga_town_id` INT,
  `city` VARCHAR(100) DEFAULT 'City of San Fernando',
  `province` VARCHAR(100) DEFAULT 'Pampanga',
  `barangay` VARCHAR(100),
  `street` VARCHAR(255),
  `latitude` DECIMAL(10, 8) DEFAULT 15.0343,
  `longitude` DECIMAL(11, 8) DEFAULT 120.6843,
  `id_document_url` VARCHAR(255),
  `resume_url` VARCHAR(255),
  `skills` JSON,
  `daily_rate` DECIMAL(10, 2) DEFAULT 600.00,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_profile_town` FOREIGN KEY (`pampanga_town_id`) REFERENCES `pampanga_towns`(`id`) ON DELETE SET NULL,
  INDEX `idx_profile_location` (`pampanga_town_id`, `barangay`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- PRE-POPULATE PAMPANGA TOWNS & SAMPLE BARANGAYS
-- =============================================================================

INSERT INTO `pampanga_towns` (`id`, `town_name`, `zip_code`, `latitude`, `longitude`) VALUES
(1, 'Angeles City', '2009', 15.1450, 120.5887),
(2, 'City of San Fernando', '2000', 15.0343, 120.6843),
(3, 'Mabalacat City', '2010', 15.2236, 120.5786),
(4, 'Floridablanca', '2006', 14.9744, 120.5367),
(5, 'Guagua', '2003', 14.9667, 120.6333),
(6, 'Lubao', '2005', 14.9406, 120.5969),
(7, 'Mexico', '2021', 15.0667, 120.7167),
(8, 'Arayat', '2012', 15.1500, 120.7667),
(9, 'Porac', '2008', 15.0717, 120.5422),
(10, 'Apalit', '2016', 14.9500, 120.7667),
(11, 'Candaba', '2013', 15.0944, 120.8278),
(12, 'Bacolor', '2001', 15.0000, 120.6500),
(13, 'Macabebe', '2018', 14.9083, 120.7139),
(14, 'Masantol', '2017', 14.9000, 120.7083),
(15, 'Minalin', '2019', 14.9667, 120.7000),
(16, 'San Luis', '2014', 15.0417, 120.7917),
(17, 'San Simon', '2015', 14.9967, 120.7817),
(18, 'Santa Ana', '2022', 15.0972, 120.7708),
(19, 'Santa Rita', '2002', 14.9983, 120.6133),
(20, 'Santo Tomas', '2020', 15.0117, 120.7167),
(21, 'Sasmuan', '2004', 14.9383, 120.6283)
ON DUPLICATE KEY UPDATE `town_name` = VALUES(`town_name`);

INSERT INTO `pampanga_barangays` (`town_id`, `barangay_name`) VALUES
(1, 'Balibago'), (1, 'Cutcut'), (1, 'Malabanias'), (1, 'Pampang'), (1, 'Santo Rosario'),
(2, 'Dolores'), (2, 'Sindalan'), (2, 'Maimpis'), (2, 'San Agustin'), (2, 'Calulut'),
(3, 'Dau'), (3, 'Mabiga'), (3, 'Camachiles'), (3, 'Poblacion'),
(4, 'Anon'), (4, 'Apalit'), (4, 'Basa Air Base'), (4, 'Fortuna'), (4, 'Poblacion'), (4, 'Solib'),
(5, 'Poblacion'), (5, 'San Pedro'), (5, 'Santa Ines'),
(6, 'Concepcion'), (6, 'Prado Siongco'), (6, 'San Jose'),
(7, 'Pariancillo'), (7, 'San Carlos'), (7, 'Laganglang'),
(8, 'Poblacion'), (8, 'Gatiawin'), (8, 'San Mateo');

-- =============================================================================
-- INDEXED SQL VIEWS FOR TOWN-BASED ISOLATION
-- =============================================================================

CREATE OR REPLACE VIEW `view_floridablanca_users` AS
SELECT u.id AS user_id, u.email, u.phone_number, u.role, u.verification_status, u.is_verified,
       p.first_name, p.last_name, p.full_name, p.barangay, p.street, p.latitude, p.longitude, t.town_name
FROM `users` u
JOIN `profiles` p ON u.id = p.user_id
JOIN `pampanga_towns` t ON p.pampanga_town_id = t.id
WHERE t.town_name = 'Floridablanca' AND (u.verification_status = 'verified' OR u.verification_status = 'approved');

CREATE OR REPLACE VIEW `view_angeles_city_users` AS
SELECT u.id AS user_id, u.email, u.phone_number, u.role, u.verification_status, u.is_verified,
       p.first_name, p.last_name, p.full_name, p.barangay, p.street, p.latitude, p.longitude, t.town_name
FROM `users` u
JOIN `profiles` p ON u.id = p.user_id
JOIN `pampanga_towns` t ON p.pampanga_town_id = t.id
WHERE t.town_name = 'Angeles City' AND (u.verification_status = 'verified' OR u.verification_status = 'approved');

CREATE OR REPLACE VIEW `view_san_fernando_users` AS
SELECT u.id AS user_id, u.email, u.phone_number, u.role, u.verification_status, u.is_verified,
       p.first_name, p.last_name, p.full_name, p.barangay, p.street, p.latitude, p.longitude, t.town_name
FROM `users` u
JOIN `profiles` p ON u.id = p.user_id
JOIN `pampanga_towns` t ON p.pampanga_town_id = t.id
WHERE t.town_name = 'City of San Fernando' AND (u.verification_status = 'verified' OR u.verification_status = 'approved');

CREATE OR REPLACE VIEW `view_mabalacat_users` AS
SELECT u.id AS user_id, u.email, u.phone_number, u.role, u.verification_status, u.is_verified,
       p.first_name, p.last_name, p.full_name, p.barangay, p.street, p.latitude, p.longitude, t.town_name
FROM `users` u
JOIN `profiles` p ON u.id = p.user_id
JOIN `pampanga_towns` t ON p.pampanga_town_id = t.id
WHERE t.town_name = 'Mabalacat City' AND (u.verification_status = 'verified' OR u.verification_status = 'approved');

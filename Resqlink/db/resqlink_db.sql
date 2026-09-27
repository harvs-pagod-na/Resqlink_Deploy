-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 21, 2026 at 05:16 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `resqlink_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity` varchar(50) NOT NULL,
  `entity_id` varchar(50) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `createdAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `icon` varchar(50) DEFAULT 'briefcase',
  `description` text DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `slug`, `icon`, `description`, `active`, `createdAt`, `updatedAt`) VALUES
(1, 'Construction & Masonry', 'construction-masonry', 'hammer', 'Carpenters, Masons, Welders, Painters & General Laborers', 1, '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(2, 'Electrical & Plumbing', 'electrical-plumbing', 'zap', 'Licensed Electricians, Pipefitters & Master Plumbers', 1, '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(3, 'Driving & Transport', 'driving-transport', 'truck', 'Truck Drivers, Delivery Riders & Heavy Equipment Operators', 1, '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(4, 'Security & Facility', 'security-facility', 'shield', 'Security Guards, Bouncers, Technicians & Building Maintenance', 1, '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(5, 'Mechanical & Auto', 'mechanical-auto', 'wrench', 'Auto Mechanics, Fabricators & Machine Technicians', 1, '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(6, 'Household & Cleaning', 'household-cleaning', 'sparkles', 'Cleaners, Janitors, Housekeepers & Utility Staff', 1, '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(7, 'Factory & Logistics', 'factory-logistics', 'package', 'Warehouse Packers, Assemblers & Factory Operators', 1, '2026-08-30 14:15:39', '2026-08-30 14:15:39');

-- --------------------------------------------------------

--
-- Table structure for table `complaints`
--

CREATE TABLE `complaints` (
  `id` int(11) NOT NULL,
  `reporter_id` int(11) NOT NULL,
  `reported_user_id` int(11) DEFAULT NULL,
  `job_id` int(11) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `category` varchar(50) DEFAULT 'NO_SHOW',
  `reason` varchar(50) DEFAULT 'NO_SHOW',
  `description` text NOT NULL,
  `evidence_url` varchar(255) DEFAULT NULL,
  `status` enum('PENDING','UNDER_REVIEW','RESOLVED','DISMISSED','open','investigating','resolved','dismissed') DEFAULT 'PENDING',
  `admin_notes` text DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `completed_jobs`
--

CREATE TABLE `completed_jobs` (
  `id` int(11) NOT NULL,
  `application_id` int(11) NOT NULL,
  `job_id` int(11) NOT NULL,
  `employer_id` int(11) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `completed_at` datetime DEFAULT NULL,
  `status` varchar(50) DEFAULT 'completed',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `conversations`
--

CREATE TABLE `conversations` (
  `id` int(11) NOT NULL,
  `participant1_id` int(11) NOT NULL,
  `participant2_id` int(11) NOT NULL,
  `job_id` int(11) DEFAULT NULL,
  `application_id` int(11) DEFAULT NULL,
  `last_message` text DEFAULT NULL,
  `last_message_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employer_profiles`
--

CREATE TABLE `employer_profiles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `company_name` varchar(150) NOT NULL,
  `company_logo` varchar(255) DEFAULT NULL,
  `industry` varchar(100) DEFAULT 'General Construction & Services',
  `company_size` varchar(50) DEFAULT '1-10 employees',
  `business_permit_no` varchar(100) DEFAULT NULL,
  `company_description` text DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT 15.02860000,
  `longitude` decimal(11,8) DEFAULT 120.69740000,
  `is_company_verified` tinyint(1) DEFAULT 0,
  `verified_at` datetime DEFAULT NULL,
  `average_rating` float NOT NULL DEFAULT 0,
  `total_reviews` int(11) NOT NULL DEFAULT 0,
  `completed_jobs_count` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `incident_tracking_logs`
--

CREATE TABLE `incident_tracking_logs` (
  `id` int(11) NOT NULL,
  `incident_id` int(11) NOT NULL,
  `actor_id` int(11) DEFAULT NULL,
  `actor_name` varchar(100) DEFAULT NULL,
  `actor_role` varchar(50) DEFAULT NULL,
  `previous_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) NOT NULL,
  `notes` text DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `recorded_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `incident_tracking_logs`
--

INSERT INTO `incident_tracking_logs` (`id`, `incident_id`, `actor_id`, `actor_name`, `actor_role`, `previous_status`, `new_status`, `notes`, `latitude`, `longitude`, `recorded_at`, `createdAt`, `updatedAt`) VALUES
(4, 3, 1, 'Central Command NOC', 'super_admin', NULL, 'Pending', 'Incident reported: Medical in Pampanga', 14.99840000, 120.62120000, '2026-09-06 07:50:20', '2026-09-06 07:50:20', '2026-09-06 07:50:20'),
(5, 4, 1, 'Central Command NOC', 'citizen', NULL, 'Pending', 'Incident reported: Medical in San Basilio', 14.99200000, 120.62200000, '2026-09-06 07:54:35', '2026-09-06 07:54:35', '2026-09-06 07:54:35'),
(6, 4, 1, 'admin (#1)', 'admin', 'Pending', 'Accepted', 'Status updated to Accepted', 14.99200000, 120.62200000, '2026-09-06 07:54:35', '2026-09-06 07:54:35', '2026-09-06 07:54:35'),
(7, 3, 4, 'admin (#4)', 'admin', 'Pending', 'Accepted', 'Status updated to Accepted', 15.00640000, 120.62920000, '2026-09-06 08:20:51', '2026-09-06 08:20:51', '2026-09-06 08:20:51'),
(8, 4, 4, 'admin (#4)', 'admin', 'Accepted', 'Accepted', 'Status updated to Accepted', 15.00000000, 120.63000000, '2026-09-06 08:22:09', '2026-09-06 08:22:09', '2026-09-06 08:22:09'),
(9, 4, 4, 'admin (#4)', 'admin', 'Accepted', 'Accepted', 'Status updated to Accepted', 15.00000000, 120.63000000, '2026-09-06 09:21:51', '2026-09-06 09:21:51', '2026-09-06 09:21:51'),
(10, 4, 4, 'admin (#4)', 'admin', 'Accepted', 'Accepted', 'Status updated to Accepted', 15.00000000, 120.63000000, '2026-09-06 09:34:56', '2026-09-06 09:34:56', '2026-09-06 09:34:56'),
(11, 4, 4, 'admin (#4)', 'admin', 'Accepted', 'Accepted', 'Status updated to Accepted', 15.00000000, 120.63000000, '2026-09-06 09:41:58', '2026-09-06 09:41:58', '2026-09-06 09:41:58'),
(12, 4, 4, 'admin (#4)', 'admin', 'Accepted', 'En Route', 'Status updated to En Route', 15.00000000, 120.63000000, '2026-09-06 09:42:02', '2026-09-06 09:42:02', '2026-09-06 09:42:02'),
(13, 4, 4, 'admin (#4)', 'admin', 'En Route', 'Accepted', 'Status updated to Accepted', 15.00000000, 120.63000000, '2026-09-06 09:48:07', '2026-09-06 09:48:07', '2026-09-06 09:48:07'),
(14, 5, 4, 'admin (#4)', 'admin', 'Pending', 'Pending', 'Status updated to Pending', 15.04190000, 120.59220000, '2026-09-06 09:57:43', '2026-09-06 09:57:43', '2026-09-06 09:57:43'),
(15, 6, 1, 'Central Command NOC', 'super_admin', NULL, 'Pending', 'Incident reported: Medical in San Basilio', 15.03390000, 120.58420000, '2026-09-06 09:57:59', '2026-09-06 09:57:59', '2026-09-06 09:57:59'),
(16, 7, 10, 'Christopher Panoy', 'user', NULL, 'Pending', 'Incident reported: Accident in San Isidro', 15.00548285, 120.61711233, '2026-09-06 10:01:53', '2026-09-06 10:01:53', '2026-09-06 10:01:53'),
(17, 7, 4, 'admin (#4)', 'admin', 'Pending', 'Accepted', 'Status updated to Accepted', 15.01348300, 120.62511200, '2026-09-06 10:02:12', '2026-09-06 10:02:12', '2026-09-06 10:02:12'),
(18, 7, 4, 'admin (#4)', 'admin', 'Accepted', 'Responder Dispatched', 'Status updated to Responder Dispatched', 15.01348300, 120.62511200, '2026-09-06 10:02:21', '2026-09-06 10:02:21', '2026-09-06 10:02:21'),
(19, 7, 4, 'admin (#4)', 'admin', 'Responder Dispatched', 'En Route', 'Status updated to En Route', 15.01348300, 120.62511200, '2026-09-06 10:02:29', '2026-09-06 10:02:29', '2026-09-06 10:02:29'),
(20, 7, 4, 'admin (#4)', 'admin', 'En Route', 'Arrived', 'Status updated to Arrived', 15.01348300, 120.62511200, '2026-09-06 10:02:38', '2026-09-06 10:02:38', '2026-09-06 10:02:38'),
(21, 7, 4, 'admin (#4)', 'admin', 'Arrived', 'En Route', 'Status updated to En Route', 15.01348300, 120.62511200, '2026-09-06 10:14:37', '2026-09-06 10:14:37', '2026-09-06 10:14:37'),
(22, 7, 4, 'admin (#4)', 'admin', 'En Route', 'Arrived', 'Status updated to Arrived', 15.01348300, 120.62511200, '2026-09-06 10:15:53', '2026-09-06 10:15:53', '2026-09-06 10:15:53'),
(23, 6, 4, 'admin (#4)', 'admin', 'Pending', 'Completed', 'Status updated to Completed', 15.04190000, 120.59220000, '2026-09-06 15:39:15', '2026-09-06 15:39:15', '2026-09-06 15:39:15'),
(24, 7, 4, 'admin (#4)', 'admin', 'Arrived', 'Completed', 'Status updated to Completed', 15.01348300, 120.62511200, '2026-09-06 15:39:22', '2026-09-06 15:39:22', '2026-09-06 15:39:22'),
(25, 7, 4, 'admin (#4)', 'admin', 'Completed', 'Accepted', 'Status updated to Accepted', 15.01348300, 120.62511200, '2026-09-06 15:52:44', '2026-09-06 15:52:44', '2026-09-06 15:52:44'),
(26, 7, 4, 'admin (#4)', 'admin', 'Accepted', 'En Route', 'Status updated to En Route', 15.01348300, 120.62511200, '2026-09-06 16:16:09', '2026-09-06 16:16:09', '2026-09-06 16:16:09'),
(27, 5, 4, 'admin (#4)', 'admin', 'Pending', 'En Route', 'Status updated to En Route', 15.04190000, 120.59220000, '2026-09-06 16:16:13', '2026-09-06 16:16:13', '2026-09-06 16:16:13'),
(28, 4, 4, 'admin (#4)', 'admin', 'Accepted', 'En Route', 'Status updated to En Route', 15.00000000, 120.63000000, '2026-09-06 16:16:16', '2026-09-06 16:16:16', '2026-09-06 16:16:16'),
(29, 3, 4, 'admin (#4)', 'admin', 'Accepted', 'En Route', 'Status updated to En Route', 15.00640000, 120.62920000, '2026-09-06 16:16:21', '2026-09-06 16:16:21', '2026-09-06 16:16:21'),
(30, 5, 4, 'admin (#4)', 'admin', 'En Route', 'Arrived', 'Status updated to Arrived', 15.04190000, 120.59220000, '2026-09-06 16:16:48', '2026-09-06 16:16:48', '2026-09-06 16:16:48'),
(31, 8, 20, 'Test Citizen', 'user', NULL, 'Pending', 'Incident reported: Medical in Santa Rita', 15.00030000, 120.61380000, '2026-09-12 14:52:50', '2026-09-12 14:52:50', '2026-09-12 14:52:50'),
(32, 9, 20, 'Test Citizen', 'user', NULL, 'Pending', 'Incident reported: Medical in Santa Rita', 15.00030000, 120.61380000, '2026-09-12 14:53:02', '2026-09-12 14:53:02', '2026-09-12 14:53:02'),
(33, 10, 20, 'Test Citizen', 'user', NULL, 'Pending', 'Incident reported: Medical in Santa Rita', 15.00030000, 120.61380000, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48'),
(34, 10, 4, 'admin (#4)', 'admin', 'Pending', 'Assigned', 'Assigned to Santa Rita Medic Unit (Medical). Awaiting responder acceptance.', 15.00030000, 120.61380000, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48'),
(35, 10, 14, 'Santa Rita Medic Unit', 'responder', 'Assigned', 'Accepted', 'Responder accepted emergency assignment. Ready for dispatch order.', 15.00030000, 120.61380000, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48'),
(36, 10, 4, 'admin (#4)', 'admin', 'Accepted', 'Responder Dispatched', 'Status updated to Responder Dispatched', 15.00030000, 120.61380000, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48'),
(37, 10, 14, 'responder (#14)', 'responder', 'Responder Dispatched', 'En Route', 'Status updated to En Route', 15.00100000, 120.61400000, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48'),
(38, 10, 14, 'responder (#14)', 'responder', 'En Route', 'Arrived', 'Status updated to Arrived', 15.00030000, 120.61380000, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48'),
(39, 10, 14, 'responder (#14)', 'responder', 'Arrived', 'Completed', 'Patient stabilized and transported to nearest medical facility.', 15.00030000, 120.61380000, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48'),
(40, 9, 2, 'admin (#2)', 'admin', 'Pending', 'Assigned', 'Status updated to Assigned', 15.00830000, 120.62180000, '2026-09-12 14:56:16', '2026-09-12 14:56:16', '2026-09-12 14:56:16'),
(41, 7, 2, 'admin (#2)', 'admin', 'En Route', 'Completed', 'Status updated to Completed', 15.01348300, 120.62511200, '2026-09-12 14:56:35', '2026-09-12 14:56:35', '2026-09-12 14:56:35'),
(42, 3, 2, 'admin (#2)', 'admin', 'En Route', 'Completed', 'Status updated to Completed', 15.00640000, 120.62920000, '2026-09-12 14:56:37', '2026-09-12 14:56:37', '2026-09-12 14:56:37'),
(43, 4, 2, 'admin (#2)', 'admin', 'En Route', 'Completed', 'Status updated to Completed', 15.00000000, 120.63000000, '2026-09-12 14:56:41', '2026-09-12 14:56:41', '2026-09-12 14:56:41'),
(44, 5, 2, 'admin (#2)', 'admin', 'Arrived', 'Arrived', 'Status updated to Arrived', 15.04190000, 120.59220000, '2026-09-12 14:56:43', '2026-09-12 14:56:43', '2026-09-12 14:56:43'),
(45, 5, 2, 'admin (#2)', 'admin', 'Arrived', 'Arrived', 'Status updated to Arrived', 15.04190000, 120.59220000, '2026-09-12 14:56:45', '2026-09-12 14:56:45', '2026-09-12 14:56:45'),
(46, 5, 2, 'admin (#2)', 'admin', 'Arrived', 'Completed', 'Status updated to Completed', 15.04190000, 120.59220000, '2026-09-12 14:56:50', '2026-09-12 14:56:50', '2026-09-12 14:56:50'),
(47, 11, 2, 'Porac MDRRMO Admin', 'admin', NULL, 'Pending', 'Incident reported: Fire in Cangatba', 15.07190000, 120.54190000, '2026-09-12 15:49:51', '2026-09-12 15:49:51', '2026-09-12 15:49:51'),
(48, 12, 20, 'Test Citizen', 'user', NULL, 'Pending', 'Incident reported: Medical in Santa Rita', 15.00030000, 120.61380000, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58'),
(49, 12, 4, 'admin (#4)', 'admin', 'Pending', 'Assigned', 'Assigned to Santa Rita Medic Unit (Medical). Awaiting responder acceptance.', 15.00030000, 120.61380000, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58'),
(50, 12, 14, 'Santa Rita Medic Unit', 'responder', 'Assigned', 'Accepted', 'Responder accepted emergency assignment. Ready for dispatch order.', 15.00030000, 120.61380000, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58'),
(51, 12, 4, 'admin (#4)', 'admin', 'Accepted', 'Responder Dispatched', 'Status updated to Responder Dispatched', 15.00030000, 120.61380000, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58'),
(52, 12, 14, 'responder (#14)', 'responder', 'Responder Dispatched', 'En Route', 'Status updated to En Route', 15.00100000, 120.61400000, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58'),
(53, 12, 14, 'responder (#14)', 'responder', 'En Route', 'Arrived', 'Status updated to Arrived', 15.00030000, 120.61380000, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58'),
(54, 12, 14, 'responder (#14)', 'responder', 'Arrived', 'Completed', 'Patient stabilized and transported to nearest medical facility.', 15.00030000, 120.61380000, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58'),
(55, 13, 2, 'Porac MDRRMO Admin', 'admin', NULL, 'Pending', 'Incident reported: Fire in Cangatba', 15.07190000, 120.54190000, '2026-09-12 16:42:26', '2026-09-12 16:42:26', '2026-09-12 16:42:26'),
(56, 8, 4, 'admin (#4)', 'admin', 'Pending', 'Assigned', 'Status updated to Assigned', 15.00830000, 120.62180000, '2026-09-19 05:43:15', '2026-09-19 05:43:15', '2026-09-19 05:43:15'),
(57, 14, 4, 'admin (#4)', 'admin', 'Assigned', 'Completed', 'Status updated to Completed', 15.03390000, 120.58420000, '2026-09-19 17:12:58', '2026-09-19 17:12:58', '2026-09-19 17:12:58'),
(58, 9, 4, 'admin (#4)', 'admin', 'Assigned', 'Completed', 'Status updated to Completed', 15.00830000, 120.62180000, '2026-09-19 17:13:02', '2026-09-19 17:13:02', '2026-09-19 17:13:02'),
(59, 8, 4, 'admin (#4)', 'admin', 'Assigned', 'Assigned', 'Status updated to Assigned', 15.00830000, 120.62180000, '2026-09-19 17:13:05', '2026-09-19 17:13:05', '2026-09-19 17:13:05'),
(60, 8, 4, 'admin (#4)', 'admin', 'Assigned', 'Completed', 'Status updated to Completed', 15.00830000, 120.62180000, '2026-09-19 17:13:09', '2026-09-19 17:13:09', '2026-09-19 17:13:09'),
(70, 23, 21, 'Burgis Madeja', 'citizen', NULL, 'Pending', 'Incident reported: Medical in San Basilio', 15.00060000, 120.61280000, '2026-09-19 17:38:23', '2026-09-19 17:38:23', '2026-09-19 17:38:23'),
(71, 23, 5, 'Santa Rita Duty Dispatcher', 'sub_admin', 'Pending', 'Accepted', 'Sub-Admin / Dispatcher Santa Rita Duty Dispatcher confirmed incident assignment for Santa Rita Sector.', 15.00060000, 120.61280000, '2026-09-19 17:55:17', '2026-09-19 17:55:17', '2026-09-19 17:55:17'),
(72, 23, 5, 'Santa Rita Duty Dispatcher', 'sub_admin', 'Accepted', 'Accepted', 'Sub-Admin / Dispatcher Santa Rita Duty Dispatcher confirmed incident assignment for Santa Rita Sector.', 15.00060000, 120.61280000, '2026-09-19 17:55:19', '2026-09-19 17:55:19', '2026-09-19 17:55:19'),
(73, 23, 5, 'Santa Rita Duty Dispatcher', 'sub_admin', 'Accepted', 'Accepted', 'Sub-Admin / Dispatcher Santa Rita Duty Dispatcher confirmed incident assignment for Santa Rita Sector.', 15.00060000, 120.61280000, '2026-09-19 17:55:19', '2026-09-19 17:55:19', '2026-09-19 17:55:19'),
(74, 23, 5, 'Santa Rita Duty Dispatcher', 'sub_admin', 'Accepted', 'Accepted', 'Sub-Admin / Dispatcher Santa Rita Duty Dispatcher confirmed incident assignment for Santa Rita Sector.', 15.00060000, 120.61280000, '2026-09-19 17:55:20', '2026-09-19 17:55:20', '2026-09-19 17:55:20'),
(75, 23, 5, 'Santa Rita Duty Dispatcher', 'sub_admin', 'Accepted', 'Accepted', 'Sub-Admin / Dispatcher Santa Rita Duty Dispatcher confirmed incident assignment for Santa Rita Sector.', 15.00060000, 120.61280000, '2026-09-19 17:55:20', '2026-09-19 17:55:20', '2026-09-19 17:55:20'),
(76, 23, 4, 'admin (#4)', 'admin', 'Accepted', 'Assigned', 'Status updated to Assigned', 15.00060000, 120.61280000, '2026-09-19 17:55:37', '2026-09-19 17:55:37', '2026-09-19 17:55:37'),
(77, 23, 5, 'sub_admin (#5)', 'sub_admin', 'Assigned', 'Accepted', 'Status updated to Accepted', 15.00060000, 120.61280000, '2026-09-19 18:06:25', '2026-09-19 18:06:25', '2026-09-19 18:06:25'),
(78, 23, 5, 'sub_admin (#5)', 'sub_admin', 'Accepted', 'Responder Dispatched', 'Status updated to Responder Dispatched', 15.00060000, 120.61280000, '2026-09-19 18:06:26', '2026-09-19 18:06:26', '2026-09-19 18:06:26'),
(79, 23, 5, 'sub_admin (#5)', 'sub_admin', 'Responder Dispatched', 'Accepted', 'Status updated to Accepted', 15.00060000, 120.61280000, '2026-09-19 18:06:31', '2026-09-19 18:06:31', '2026-09-19 18:06:31'),
(80, 23, 5, 'sub_admin (#5)', 'sub_admin', 'Accepted', 'Responder Dispatched', 'Status updated to Responder Dispatched', 15.00060000, 120.61280000, '2026-09-19 18:06:32', '2026-09-19 18:06:32', '2026-09-19 18:06:32'),
(81, 23, 5, 'sub_admin (#5)', 'sub_admin', 'Responder Dispatched', 'En Route', 'Status updated to En Route', 15.00060000, 120.61280000, '2026-09-19 18:06:43', '2026-09-19 18:06:43', '2026-09-19 18:06:43'),
(82, 23, 5, 'sub_admin (#5)', 'sub_admin', 'En Route', 'Arrived', 'Status updated to Arrived', 15.00060000, 120.61280000, '2026-09-19 18:06:46', '2026-09-19 18:06:46', '2026-09-19 18:06:46'),
(83, 23, 5, 'sub_admin (#5)', 'sub_admin', 'Arrived', 'Completed', 'Status updated to Completed', 15.00060000, 120.61280000, '2026-09-19 18:06:48', '2026-09-19 18:06:48', '2026-09-19 18:06:48'),
(84, 24, 2, 'Porac MDRRMO Admin', 'admin', NULL, 'Pending', 'Incident reported: Fire in Cangatba', 15.07190000, 120.54190000, '2026-09-19 19:04:53', '2026-09-19 19:04:53', '2026-09-19 19:04:53'),
(85, 25, 20, 'Test Citizen', 'user', NULL, 'Pending', 'Incident reported: Medical in Santa Rita', 15.00030000, 120.61380000, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11'),
(86, 25, 4, 'admin (#4)', 'admin', 'Pending', 'Assigned', 'Assigned to Santa Rita Medic Unit (Medical). Awaiting responder acceptance.', 15.00030000, 120.61380000, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11'),
(87, 25, 14, 'Santa Rita Medic Unit', 'responder', 'Assigned', 'Accepted', 'Responder accepted emergency assignment. Ready for dispatch order.', 15.00030000, 120.61380000, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11'),
(88, 25, 4, 'admin (#4)', 'admin', 'Accepted', 'Responder Dispatched', 'Status updated to Responder Dispatched', 15.00030000, 120.61380000, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11'),
(89, 25, 14, 'responder (#14)', 'responder', 'Responder Dispatched', 'En Route', 'Status updated to En Route', 15.00100000, 120.61400000, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11'),
(90, 25, 14, 'responder (#14)', 'responder', 'En Route', 'Arrived', 'Status updated to Arrived', 15.00030000, 120.61380000, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11'),
(91, 25, 14, 'responder (#14)', 'responder', 'Arrived', 'Completed', 'Patient stabilized and transported to nearest medical facility.', 15.00030000, 120.61380000, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11');

-- --------------------------------------------------------

--
-- Table structure for table `interviews`
--

CREATE TABLE `interviews` (
  `id` int(11) NOT NULL,
  `application_id` int(11) NOT NULL,
  `job_id` int(11) NOT NULL,
  `employer_id` int(11) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `interview_type` enum('in_person','virtual') DEFAULT 'in_person',
  `interview_date` date NOT NULL,
  `interview_time` varchar(20) NOT NULL,
  `location_name` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `town` varchar(100) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT 15.03430000,
  `longitude` decimal(11,8) DEFAULT 120.68430000,
  `meeting_link` varchar(550) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('scheduled','en_route','arrived','completed','cancelled') DEFAULT 'scheduled',
  `worker_lat` decimal(10,8) DEFAULT NULL,
  `worker_lng` decimal(11,8) DEFAULT NULL,
  `worker_last_updated` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` int(11) NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `employer_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `job_image` varchar(255) DEFAULT NULL,
  `job_type` enum('full_time','part_time','contract','daily') DEFAULT 'full_time',
  `salary_type` enum('hourly','daily','monthly','project') DEFAULT 'daily',
  `salary_min` decimal(10,2) NOT NULL,
  `salary_max` decimal(10,2) DEFAULT NULL,
  `vacancies` int(11) DEFAULT 1,
  `location_address` varchar(255) NOT NULL,
  `city` varchar(100) DEFAULT 'City of San Fernando',
  `province` varchar(100) DEFAULT 'Pampanga',
  `latitude` decimal(10,8) DEFAULT 15.03430000,
  `longitude` decimal(11,8) DEFAULT 120.68430000,
  `status` enum('active','paused','closed') DEFAULT 'active',
  `requirements` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`requirements`)),
  `benefits` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`benefits`)),
  `views_count` int(11) DEFAULT 0,
  `applications_count` int(11) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_applications`
--

CREATE TABLE `job_applications` (
  `id` int(11) NOT NULL,
  `job_id` int(11) NOT NULL,
  `employee_id` int(11) NOT NULL,
  `status` enum('applied','pending','reviewing','under_review','shortlisted','interview','interview_scheduled','hired','completed','rejected') DEFAULT 'applied',
  `cover_note` text DEFAULT NULL,
  `resume_url` varchar(255) DEFAULT NULL,
  `work_start_date` date DEFAULT NULL,
  `work_start_time` varchar(20) DEFAULT NULL,
  `work_location` varchar(255) DEFAULT NULL,
  `work_notes` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `conversation_id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `receiver_id` int(11) DEFAULT NULL,
  `message_text` text NOT NULL,
  `attachment_url` varchar(255) DEFAULT NULL,
  `is_system_message` tinyint(1) DEFAULT 0,
  `is_read` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `receiver_id` int(11) DEFAULT NULL,
  `target_group` enum('all','employers','employees','specific') DEFAULT 'specific',
  `type` enum('broadcast','booking_update','system_alert','important_activity') DEFAULT 'broadcast',
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `sender_id`, `receiver_id`, `target_group`, `type`, `title`, `message`, `booking_id`, `is_read`, `createdAt`, `updatedAt`) VALUES
(1, NULL, NULL, 'specific', '', '🚨 Emergency Assignment Confirmed', 'Santa Rita Sub-Admin Command has confirmed your emergency assignment (#14). Responders are preparing deployment.', NULL, 0, '2026-09-19 06:17:17', '2026-09-19 06:17:17'),
(2, NULL, NULL, 'specific', '', '⚡ Sub-Admin Confirmed Assignment', 'Sub-Admin confirmed assignment for Incident #14 in Santa Rita.', NULL, 0, '2026-09-19 06:17:17', '2026-09-19 06:17:17'),
(5, 5, 21, 'specific', 'system_alert', '🚨 Emergency Assignment Confirmed', 'Your emergency in Santa Rita has been confirmed by Santa Rita Dispatch Command. Rescue units are being mobilized.', NULL, 0, '2026-09-19 17:55:17', '2026-09-19 17:55:17'),
(6, 5, NULL, 'specific', 'important_activity', '✓ Sub-Admin Confirmed Assignment', 'Santa Rita Duty Dispatcher (Santa Rita Sector) confirmed emergency assignment for Incident #23.', NULL, 0, '2026-09-19 17:55:17', '2026-09-19 17:55:17'),
(7, 5, 21, 'specific', 'system_alert', '🚨 Emergency Assignment Confirmed', 'Your emergency in Santa Rita has been confirmed by Santa Rita Dispatch Command. Rescue units are being mobilized.', NULL, 0, '2026-09-19 17:55:19', '2026-09-19 17:55:19'),
(8, 5, NULL, 'specific', 'important_activity', '✓ Sub-Admin Confirmed Assignment', 'Santa Rita Duty Dispatcher (Santa Rita Sector) confirmed emergency assignment for Incident #23.', NULL, 0, '2026-09-19 17:55:19', '2026-09-19 17:55:19'),
(9, 5, 21, 'specific', 'system_alert', '🚨 Emergency Assignment Confirmed', 'Your emergency in Santa Rita has been confirmed by Santa Rita Dispatch Command. Rescue units are being mobilized.', NULL, 0, '2026-09-19 17:55:19', '2026-09-19 17:55:19'),
(10, 5, NULL, 'specific', 'important_activity', '✓ Sub-Admin Confirmed Assignment', 'Santa Rita Duty Dispatcher (Santa Rita Sector) confirmed emergency assignment for Incident #23.', NULL, 0, '2026-09-19 17:55:19', '2026-09-19 17:55:19'),
(11, 5, 21, 'specific', 'system_alert', '🚨 Emergency Assignment Confirmed', 'Your emergency in Santa Rita has been confirmed by Santa Rita Dispatch Command. Rescue units are being mobilized.', NULL, 0, '2026-09-19 17:55:20', '2026-09-19 17:55:20'),
(12, 5, NULL, 'specific', 'important_activity', '✓ Sub-Admin Confirmed Assignment', 'Santa Rita Duty Dispatcher (Santa Rita Sector) confirmed emergency assignment for Incident #23.', NULL, 0, '2026-09-19 17:55:20', '2026-09-19 17:55:20'),
(13, 5, 21, 'specific', 'system_alert', '🚨 Emergency Assignment Confirmed', 'Your emergency in Santa Rita has been confirmed by Santa Rita Dispatch Command. Rescue units are being mobilized.', NULL, 0, '2026-09-19 17:55:20', '2026-09-19 17:55:20'),
(14, 5, NULL, 'specific', 'important_activity', '✓ Sub-Admin Confirmed Assignment', 'Santa Rita Duty Dispatcher (Santa Rita Sector) confirmed emergency assignment for Incident #23.', NULL, 0, '2026-09-19 17:55:20', '2026-09-19 17:55:20');

-- --------------------------------------------------------

--
-- Table structure for table `pampanga_barangays`
--

CREATE TABLE `pampanga_barangays` (
  `id` int(11) NOT NULL,
  `town_id` int(11) NOT NULL,
  `barangay_name` varchar(100) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pampanga_locations`
--

CREATE TABLE `pampanga_locations` (
  `id` int(11) NOT NULL,
  `municipality` varchar(100) NOT NULL,
  `barangay` varchar(100) NOT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pampanga_towns`
--

CREATE TABLE `pampanga_towns` (
  `id` int(11) NOT NULL,
  `town_name` varchar(100) NOT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT 15.03430000,
  `longitude` decimal(11,8) DEFAULT 120.68430000,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `penalties`
--

CREATE TABLE `penalties` (
  `id` int(11) NOT NULL,
  `report_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `action_taken` enum('FINE','SUSPENSION','BAN','WARNING','NONE') NOT NULL DEFAULT 'WARNING',
  `fine_amount` decimal(10,2) DEFAULT 0.00,
  `suspension_ends_at` datetime DEFAULT NULL,
  `issued_by` int(11) DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `profiles`
--

CREATE TABLE `profiles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `headline` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `birthdate` date DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `pampanga_town_id` int(11) DEFAULT NULL,
  `barangay` varchar(100) DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `id_document_url` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT 'City of San Fernando',
  `province` varchar(100) DEFAULT 'Pampanga',
  `latitude` decimal(10,8) DEFAULT 15.03430000,
  `longitude` decimal(11,8) DEFAULT 120.68430000,
  `skills` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`skills`)),
  `hourly_rate` decimal(10,2) DEFAULT 100.00,
  `daily_rate` decimal(10,2) DEFAULT 600.00,
  `availability_status` enum('available','busy','hired') DEFAULT 'available',
  `resume_url` varchar(255) DEFAULT NULL,
  `certifications` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`certifications`)),
  `years_experience` int(11) DEFAULT 1,
  `average_rating` float NOT NULL DEFAULT 0,
  `total_reviews` int(11) NOT NULL DEFAULT 0,
  `completed_jobs_count` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `blood_type` varchar(10) DEFAULT 'Unknown',
  `medical_conditions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`medical_conditions`)),
  `special_needs` varchar(100) DEFAULT 'None',
  `household_count` int(11) DEFAULT 1,
  `household_infants` int(11) DEFAULT 0,
  `household_seniors` int(11) DEFAULT 0,
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_phone` varchar(25) DEFAULT NULL,
  `emergency_contact_relation` varchar(50) DEFAULT NULL,
  `responder_badge_number` varchar(50) DEFAULT NULL,
  `responder_unit` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `profiles`
--

INSERT INTO `profiles` (`id`, `user_id`, `first_name`, `last_name`, `avatar_url`, `headline`, `bio`, `birthdate`, `address`, `full_name`, `pampanga_town_id`, `barangay`, `street`, `id_document_url`, `city`, `province`, `latitude`, `longitude`, `skills`, `hourly_rate`, `daily_rate`, `availability_status`, `resume_url`, `certifications`, `years_experience`, `average_rating`, `total_reviews`, `completed_jobs_count`, `createdAt`, `updatedAt`, `blood_type`, `medical_conditions`, `special_needs`, `household_count`, `household_infants`, `household_seniors`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`, `responder_badge_number`, `responder_unit`) VALUES
(1, 1, 'Central', 'Command NOC', NULL, 'Central Command NOC Super Administrator', NULL, NULL, 'Pampanga, Pampanga', 'Central Command NOC', NULL, NULL, NULL, NULL, 'Pampanga', 'Pampanga', 15.02500000, 120.59000000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'Unknown', NULL, 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(2, 2, 'Porac', 'MDRRMO Admin', NULL, 'MDRRMO Chief Administrator - Porac, Pampanga', NULL, NULL, 'Porac, Pampanga', 'Porac MDRRMO Admin', NULL, NULL, NULL, NULL, 'Porac', 'Pampanga', 15.06890000, 120.54000000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'Unknown', NULL, 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(3, 3, 'Porac', 'Duty Dispatcher', NULL, 'MDRRMO Sub-Admin & Dispatch Officer - Porac, Pampanga', NULL, NULL, 'Porac, Pampanga', 'Porac Duty Dispatcher', NULL, NULL, NULL, NULL, 'Porac', 'Pampanga', 15.06890000, 120.54000000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'Unknown', NULL, 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(4, 4, 'Santa Rita', 'MDRRMO Admin', NULL, 'MDRRMO Chief Administrator - Santa Rita, Pampanga', NULL, NULL, 'Santa Rita, Pampanga', 'Santa Rita MDRRMO Admin', NULL, NULL, NULL, NULL, 'Santa Rita', 'Pampanga', 14.99860000, 120.61860000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'Unknown', NULL, 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(5, 5, 'Santa Rita', 'Duty Dispatcher', NULL, 'MDRRMO Sub-Admin & Dispatch Officer - Santa Rita, Pampanga', NULL, NULL, 'Santa Rita, Pampanga', 'Santa Rita Duty Dispatcher', NULL, NULL, NULL, NULL, 'Santa Rita', 'Pampanga', 14.99860000, 120.61860000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'Unknown', NULL, 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(6, 6, 'Guagua', 'MDRRMO Admin', NULL, 'MDRRMO Chief Administrator - Guagua, Pampanga', NULL, NULL, 'Guagua, Pampanga', 'Guagua MDRRMO Admin', NULL, NULL, NULL, NULL, 'Guagua', 'Pampanga', 14.96670000, 120.63330000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'Unknown', NULL, 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(7, 7, 'Guagua', 'Duty Dispatcher', NULL, 'MDRRMO Sub-Admin & Dispatch Officer - Guagua, Pampanga', NULL, NULL, 'Guagua, Pampanga', 'Guagua Duty Dispatcher', NULL, NULL, NULL, NULL, 'Guagua', 'Pampanga', 14.96670000, 120.63330000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'Unknown', NULL, 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(10, 10, 'Christopher', 'Panoy', NULL, 'Registered Citizen', NULL, NULL, 'San Basilio, Santa Rita, Pampanga', 'Christopher Panoy', NULL, 'San Basilio', NULL, NULL, 'Santa Rita', 'Pampanga', 15.03430000, 120.68430000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-06 07:26:34', '2026-09-06 10:01:15', 'O+', '[\"[\",\"]\",\"Asthma / Respiratory\",\"Hypertension\",\"Heart Condition\",\"Visual / Hearing Impairment\",\"Dialysis Patient\",\"Severe Allergy\",\"Epilepsy / Seizure\",\"Diabetes\"]', 'None', 1, 0, 0, 'Hatdog', '', '', NULL, NULL),
(11, 11, 'Porac', 'Medic Unit 1', NULL, 'MDRRMO Porac Emergency Medical Service', NULL, NULL, 'Porac, Pampanga', 'Porac Medic Unit 1', NULL, NULL, NULL, NULL, 'Porac', 'Pampanga', 15.06890000, 120.54000000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'MED-POR-01', 'Porac EMS Ambulance 1'),
(12, 12, 'Porac', 'Police Mobile 1', NULL, 'PNP Porac Municipal Police Station Tactical Unit', NULL, NULL, 'Porac, Pampanga', 'Porac Police Mobile 1', NULL, NULL, NULL, NULL, 'Porac', 'Pampanga', 15.07100000, 120.54200000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'PNP-POR-101', 'PNP Porac Patrol Car 01'),
(13, 13, 'Porac', 'Fire Engine 1', NULL, 'BFP Porac Fire Protection & Rescue Engine', NULL, NULL, 'Porac, Pampanga', 'Porac Fire Engine 1', NULL, NULL, NULL, NULL, 'Porac', 'Pampanga', 15.06700000, 120.53800000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'BFP-POR-201', 'BFP Porac Fire Engine 1'),
(14, 14, 'Sta. Rita', 'Medic Unit 1', NULL, 'MDRRMO Santa Rita Emergency Medical Service', NULL, NULL, 'Santa Rita, Pampanga', 'Sta. Rita Medic Unit 1', NULL, NULL, NULL, NULL, 'Santa Rita', 'Pampanga', 14.99860000, 120.61860000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'MED-STR-01', 'Santa Rita EMS Ambulance 1'),
(15, 15, 'Sta. Rita', 'Police Mobile 1', NULL, 'PNP Santa Rita Police Mobile Unit', NULL, NULL, 'Santa Rita, Pampanga', 'Sta. Rita Police Mobile 1', NULL, NULL, NULL, NULL, 'Santa Rita', 'Pampanga', 15.00100000, 120.62000000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'PNP-STR-101', 'PNP Santa Rita Patrol Car 01'),
(16, 16, 'Sta. Rita', 'Fire Engine 1', NULL, 'BFP Santa Rita Fire & Rescue Service', NULL, NULL, 'Santa Rita, Pampanga', 'Sta. Rita Fire Engine 1', NULL, NULL, NULL, NULL, 'Santa Rita', 'Pampanga', 14.99700000, 120.61600000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'BFP-STR-201', 'BFP Santa Rita Fire Engine 1'),
(17, 17, 'Guagua', 'Medic Unit 1', NULL, 'MDRRMO Guagua Emergency Medical Service', NULL, NULL, 'Guagua, Pampanga', 'Guagua Medic Unit 1', NULL, NULL, NULL, NULL, 'Guagua', 'Pampanga', 14.96670000, 120.63330000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'MED-GUA-01', 'Guagua EMS Ambulance 1'),
(18, 18, 'Guagua', 'Police Mobile 1', NULL, 'PNP Guagua Police Mobile Unit', NULL, NULL, 'Guagua, Pampanga', 'Guagua Police Mobile 1', NULL, NULL, NULL, NULL, 'Guagua', 'Pampanga', 14.96800000, 120.63500000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'PNP-GUA-101', 'PNP Guagua Patrol Car 01'),
(19, 19, 'Guagua', 'Fire Engine 1', NULL, 'BFP Guagua Fire & Rescue Engine', NULL, NULL, 'Guagua, Pampanga', 'Guagua Fire Engine 1', NULL, NULL, NULL, NULL, 'Guagua', 'Pampanga', 14.96500000, 120.63100000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, 'BFP-GUA-201', 'BFP Guagua Fire Engine 1'),
(20, 20, 'Test', 'Citizen', NULL, 'Registered Citizen', NULL, NULL, 'Santa Rita, Pampanga', 'Test Citizen', NULL, '', NULL, NULL, 'Santa Rita', 'Pampanga', 15.03430000, 120.68430000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-12 14:51:20', '2026-09-12 14:51:20', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL),
(21, 21, 'Burgis', 'Madeja', NULL, 'Registered Citizen', NULL, NULL, 'San Basilio, Santa Rita, Pampanga', 'Burgis Madeja', NULL, 'San Basilio', NULL, NULL, 'Santa Rita', 'Pampanga', 15.03430000, 120.68430000, '[]', 100.00, 600.00, 'available', NULL, '[]', 1, 0, 0, 0, '2026-09-19 17:15:27', '2026-09-19 17:15:27', 'Unknown', '[]', 'None', 1, 0, 0, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `public_alerts`
--

CREATE TABLE `public_alerts` (
  `id` int(11) NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `severity` enum('Low','Advisory','Moderate','High','Critical') NOT NULL DEFAULT 'High',
  `alert_type` enum('Typhoon/Flood','Fire Hazard','Earthquake','Road Advisory','Public Safety','Health Advisory','General Announcement') NOT NULL DEFAULT 'General Announcement',
  `target_barangay` varchar(100) NOT NULL DEFAULT 'All Porac',
  `target_municipality` varchar(100) NOT NULL DEFAULT 'Porac',
  `author_id` int(11) DEFAULT NULL,
  `author_name` varchar(100) NOT NULL DEFAULT 'MDRRMO Porac Command',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `published_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ratings`
--

CREATE TABLE `ratings` (
  `id` int(11) NOT NULL,
  `job_id` int(11) NOT NULL,
  `rater_id` int(11) NOT NULL,
  `ratee_id` int(11) NOT NULL,
  `target_role` enum('employer','employee') NOT NULL,
  `rating_score` int(11) NOT NULL,
  `review_comment` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `resq_requests`
--

CREATE TABLE `resq_requests` (
  `id` int(11) NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `user_id` int(11) NOT NULL,
  `emergency_type` enum('Fire','Crime/Police','Medical','Flood/Disaster','Accident','Evacuation','Other') NOT NULL DEFAULT 'Medical',
  `severity_level` enum('Critical','High','Moderate','Low') NOT NULL DEFAULT 'High',
  `description` text DEFAULT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `address_location` varchar(255) DEFAULT NULL,
  `photo_url` varchar(255) DEFAULT NULL,
  `contact_number` varchar(25) DEFAULT NULL,
  `status` enum('Pending','Assigned','Accepted','Validated','Responder Dispatched','Dispatched','En Route','On Scene','Arrived','In Progress','Resolved','Completed','Cancelled','Closed') DEFAULT 'Pending',
  `assigned_responder_id` int(11) DEFAULT NULL,
  `responder_name` varchar(255) DEFAULT NULL,
  `responder_phone` varchar(25) DEFAULT NULL,
  `responder_unit` varchar(255) DEFAULT NULL,
  `responder_lat` decimal(10,8) DEFAULT NULL,
  `responder_lng` decimal(11,8) DEFAULT NULL,
  `dispatcher_notes` text DEFAULT NULL,
  `dispatched_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `reporter_name` varchar(150) DEFAULT NULL,
  `municipality` varchar(100) NOT NULL DEFAULT 'Porac',
  `barangay` varchar(100) DEFAULT NULL,
  `landmark` varchar(200) DEFAULT NULL,
  `target_agency` enum('MDRRMO','PNP','BFP','Multi-Agency','Unassigned') NOT NULL DEFAULT 'MDRRMO',
  `assigned_department` varchar(50) DEFAULT 'Medical',
  `is_verified_incident` tinyint(1) DEFAULT 0,
  `assigned_agency` varchar(50) DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `reported_at` datetime DEFAULT NULL,
  `validated_at` datetime DEFAULT NULL,
  `en_route_at` datetime DEFAULT NULL,
  `on_scene_at` datetime DEFAULT NULL,
  `arrived_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `response_duration_seconds` int(11) DEFAULT NULL,
  `assigned_subadmin_id` int(11) DEFAULT NULL,
  `assigned_sector` varchar(100) DEFAULT NULL,
  `subadmin_confirmed_at` datetime DEFAULT NULL,
  `subadmin_notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `resq_requests`
--

INSERT INTO `resq_requests` (`id`, `uuid`, `user_id`, `emergency_type`, `severity_level`, `description`, `latitude`, `longitude`, `address_location`, `photo_url`, `contact_number`, `status`, `assigned_responder_id`, `responder_name`, `responder_phone`, `responder_unit`, `responder_lat`, `responder_lng`, `dispatcher_notes`, `dispatched_at`, `resolved_at`, `completed_at`, `createdAt`, `updatedAt`, `reporter_name`, `municipality`, `barangay`, `landmark`, `target_agency`, `assigned_department`, `is_verified_incident`, `assigned_agency`, `resolution_notes`, `reported_at`, `validated_at`, `en_route_at`, `on_scene_at`, `arrived_at`, `closed_at`, `response_duration_seconds`, `assigned_subadmin_id`, `assigned_sector`, `subadmin_confirmed_at`, `subadmin_notes`) VALUES
(3, '408d6c48-9b33-4e56-a0a4-3d39ebf3709d', 1, 'Medical', 'High', 'Injured\n[PATIENT TELEMETRY: Blood: Unknown]', 14.99840000, 120.62120000, 'San Basilio', '/uploads/incidents/incident-1788679823279-230234.jpg', '0917-100-0000', 'Completed', NULL, 'MDRRMO Rescue Team Alpha', '0917-123-4567', 'Unit-01', 15.00640000, 120.62920000, '', '2026-09-06 16:16:21', '2026-09-12 14:56:37', '2026-09-12 14:56:37', '2026-09-06 07:50:20', '2026-09-12 14:56:37', 'Central Command NOC', 'Pampanga', 'Poblacion', NULL, 'MDRRMO', 'Medical', 1, NULL, NULL, '2026-09-06 07:50:20', NULL, '2026-09-06 16:16:21', NULL, NULL, NULL, 513617, NULL, NULL, NULL, NULL),
(4, '746321f6-7d94-483b-bddc-908f9952f72e', 1, 'Medical', 'High', 'Injured patient telemetry test', 14.99200000, 120.62200000, '[Santa Rita - Brgy. San Basilio] Near San Basilio Chapel', NULL, '09171234567', 'Completed', NULL, 'MDRRMO Santa Rita Unit 1', '0917-000-1111', 'Unit-01', 15.00000000, 120.63000000, '', '2026-09-06 09:42:02', '2026-09-12 14:56:41', '2026-09-12 14:56:41', '2026-09-06 07:54:35', '2026-09-12 14:56:41', 'Central Command NOC', 'Santa Rita', 'San Basilio', NULL, 'MDRRMO', 'Medical', 1, NULL, NULL, '2026-09-06 07:54:35', '2026-09-06 07:54:35', '2026-09-06 09:42:02', NULL, NULL, NULL, 537279, NULL, NULL, NULL, NULL),
(5, '81725a3f-3336-486f-a0cd-02383748acb9', 1, 'Medical', 'High', 'Test emergency transmission from script', 15.03390000, 120.58420000, '[Santa Rita - Brgy. San Basilio] 118 Zone 1 San Basilio', NULL, '09171234567', 'Completed', NULL, 'MDRRMO Rescue Team Alpha', '0917-123-4567', 'Unit-01', 15.04190000, 120.59220000, '', '2026-09-06 16:16:13', '2026-09-12 14:56:50', '2026-09-12 14:56:50', '2026-09-06 09:54:17', '2026-09-12 14:56:50', 'Test Citizen', 'Santa Rita', 'San Basilio', NULL, 'MDRRMO', 'Medical', 1, NULL, NULL, '2026-09-06 09:54:17', NULL, '2026-09-06 16:16:13', '2026-09-12 14:56:43', '2026-09-12 14:56:43', NULL, 513637, NULL, NULL, NULL, NULL),
(6, '5c686afe-b4a4-46bc-a1d5-2716a808f88d', 1, 'Medical', 'High', 'Live test dispatch from San Basilio', 15.03390000, 120.58420000, '[Santa Rita - Brgy. San Basilio] 118 Zone 1 San Basilio', NULL, '0917-100-0000', 'Completed', NULL, 'MDRRMO Rescue Team Alpha', '0917-123-4567', 'Unit-01', 15.04190000, 120.59220000, '', NULL, '2026-09-06 15:39:15', NULL, '2026-09-06 09:57:59', '2026-09-06 15:39:15', 'Central Command NOC', 'Santa Rita', 'San Basilio', NULL, 'MDRRMO', 'Medical', 0, NULL, NULL, '2026-09-06 09:57:59', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(7, '994542e4-3d36-4ec8-8254-1cef8a744b18', 10, 'Accident', 'High', 'Note: Help me \n[PATIENT TELEMETRY: Blood: O+ | Conditions: [, ], Asthma / Respiratory, Hypertension, Heart Condition, Visual / Hearing Impairment, Dialysis Patient, Severe Allergy, Epilepsy / Seizure, Diabetes | Kin Contact: Hatdog (N/A)]', 15.00548285, 120.61711233, '[Santa Rita] Brgy. San Isidro', '/uploads/incidents/incident-1788688911194-750555.jpg', '09563304749', 'Completed', NULL, 'MDRRMO Rescue Team Alpha', '0917-123-4567', '10994', 15.01348300, 120.62511200, '', '2026-09-06 10:02:21', '2026-09-12 14:56:35', '2026-09-12 14:56:35', '2026-09-06 10:01:53', '2026-09-12 14:56:35', 'Christopher Panoy', 'Santa Rita', 'San Isidro', NULL, 'MDRRMO', 'Medical', 1, NULL, NULL, '2026-09-06 10:01:53', '2026-09-06 10:02:12', '2026-09-06 10:02:29', '2026-09-06 10:02:38', NULL, NULL, 536054, NULL, NULL, NULL, NULL),
(8, 'c40c8639-b061-49e6-a021-22e84e86e8e1', 20, 'Medical', 'High', '', 15.00030000, 120.61380000, '[Santa Rita] Incident Location', NULL, '09123456789', 'Completed', NULL, '', '', '', 15.00830000, 120.62180000, '', NULL, '2026-09-19 17:13:09', '2026-09-19 17:13:09', '2026-09-12 14:52:50', '2026-09-19 17:13:09', 'Test Citizen', 'Santa Rita', 'Poblacion', 'Santa Rita Town Plaza near Church', 'MDRRMO', 'Medical', 0, NULL, NULL, '2026-09-12 14:52:50', NULL, NULL, NULL, NULL, NULL, NULL, 5, 'Santa Rita', NULL, NULL),
(9, 'd94ccde5-d32a-48e5-a6d7-8d9087575fb8', 20, 'Medical', 'High', '', 15.00030000, 120.61380000, '[Santa Rita] Incident Location', NULL, '09123456789', 'Completed', NULL, '', '', '', 15.00830000, 120.62180000, '', NULL, '2026-09-19 17:13:02', '2026-09-19 17:13:02', '2026-09-12 14:53:02', '2026-09-19 17:13:02', 'Test Citizen', 'Santa Rita', 'Poblacion', 'Santa Rita Town Plaza near Church', 'BFP', 'Fire', 0, NULL, NULL, '2026-09-12 14:53:02', NULL, NULL, NULL, NULL, NULL, NULL, 5, 'Santa Rita', NULL, NULL),
(10, '2904ac3b-c26d-412e-9296-da0294e15779', 20, 'Medical', 'High', '', 15.00030000, 120.61380000, '[Santa Rita] Incident Location', NULL, '09123456789', 'Completed', 14, 'Santa Rita Medic Unit', NULL, 'Santa Rita Medical Team Alpha', 15.00030000, 120.61380000, NULL, '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48', 'Test Citizen', 'Santa Rita', 'Poblacion', 'Santa Rita Town Plaza near Church', 'MDRRMO', 'Medical', 1, NULL, 'Patient stabilized and transported to nearest medical facility.', '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48', '2026-09-12 14:53:48', NULL, 1, NULL, NULL, NULL, NULL),
(11, 'e6c5e180-2ea7-49bd-8cd3-dd7df15b1aab', 2, 'Fire', 'High', 'Test Porac incident for cross-jurisdiction defense verification', 15.07190000, 120.54190000, 'Brgy. Cangatba, Porac, Pampanga', NULL, '0917-000-9999', 'Pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-12 15:49:51', '2026-09-12 15:49:51', 'Porac MDRRMO Admin', 'Porac', 'Cangatba', NULL, 'BFP', 'Medical', 0, NULL, NULL, '2026-09-12 15:49:51', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(12, 'ae944b22-de46-4488-9579-46656e701969', 20, 'Medical', 'High', '', 15.00030000, 120.61380000, '[Santa Rita] Incident Location', NULL, '09123456789', 'Completed', 14, 'Santa Rita Medic Unit', NULL, 'Santa Rita Medical Team Alpha', 15.00030000, 120.61380000, NULL, '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58', 'Test Citizen', 'Santa Rita', 'Poblacion', 'Santa Rita Town Plaza near Church', 'MDRRMO', 'Medical', 1, NULL, 'Patient stabilized and transported to nearest medical facility.', '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58', '2026-09-12 16:40:58', NULL, 0, NULL, NULL, NULL, NULL),
(13, 'efec0852-a947-44b1-883e-dbdf70f80bca', 2, 'Fire', 'High', 'Test Porac incident for cross-jurisdiction defense verification', 15.07190000, 120.54190000, 'Brgy. Cangatba, Porac, Pampanga', NULL, '0917-000-9999', 'Pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-12 16:42:26', '2026-09-12 16:42:26', 'Porac MDRRMO Admin', 'Porac', 'Cangatba', NULL, 'BFP', 'Medical', 0, NULL, NULL, '2026-09-12 16:42:26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(14, '370f6b3e-21df-4e67-8367-dc3183a06b87', 10, 'Medical', 'High', 'Verification test for subadmin dispatch and GPS coordinates integrity', 15.03390000, 120.58420000, 'Brgy San Basilio, Santa Rita, Pampanga', NULL, '09171234567', 'Completed', 11, 'Unit-01 Rescue', '', '', NULL, NULL, '', NULL, '2026-09-19 17:12:58', '2026-09-19 17:12:58', '2026-09-19 06:17:17', '2026-09-19 17:12:58', 'Juan Test Dela Cruz', 'Santa Rita', NULL, NULL, 'MDRRMO', 'MDRRMO', 0, NULL, NULL, '2026-09-19 06:17:17', NULL, NULL, NULL, NULL, NULL, NULL, 3, 'Santa Rita', '2026-09-19 06:17:17', 'Unit verified and standing by for route clearance.'),
(23, 'c93aeb56-a54a-41f6-b167-bd6e94b99a0d', 21, 'Medical', 'High', '', 15.00060000, 120.61280000, '[Santa Rita] Brgy. San Basilio', NULL, '09488988741', 'Completed', NULL, 'Santa Rita Duty Dispatcher', '0917-111-9999', 'Alpha Tactical Medic-01', 15.00060000, 120.61280000, '', '2026-09-19 18:06:26', '2026-09-19 18:06:48', '2026-09-19 18:06:48', '2026-09-19 17:38:23', '2026-09-19 18:06:48', 'Burgis Madeja', 'Santa Rita', 'San Basilio', NULL, 'MDRRMO', 'Medical', 1, NULL, NULL, '2026-09-19 17:38:23', '2026-09-19 18:06:25', '2026-09-19 18:06:43', '2026-09-19 18:06:45', '2026-09-19 18:06:45', NULL, 22, 5, 'Santa Rita', '2026-09-19 17:55:20', NULL),
(24, '56afc1b5-748f-40d9-940c-8b18deb12909', 2, 'Fire', 'High', 'Test Porac incident for cross-jurisdiction defense verification', 15.07190000, 120.54190000, 'Brgy. Cangatba, Porac, Pampanga', NULL, '0917-000-9999', 'Pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-19 19:04:53', '2026-09-19 19:04:53', 'Porac MDRRMO Admin', 'Porac', 'Cangatba', NULL, 'BFP', 'Medical', 0, NULL, NULL, '2026-09-19 19:04:53', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(25, '63fb9c27-38c2-4815-aea0-a38f8632ba78', 20, 'Medical', 'High', '', 15.00030000, 120.61380000, '[Santa Rita] Incident Location', NULL, '09123456789', 'Completed', 14, 'Santa Rita Medic Unit', NULL, 'Santa Rita Medical Team Alpha', 15.00030000, 120.61380000, NULL, '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11', 'Test Citizen', 'Santa Rita', 'Poblacion', 'Santa Rita Town Plaza near Church', 'MDRRMO', 'Medical', 1, NULL, 'Patient stabilized and transported to nearest medical facility.', '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11', '2026-09-19 19:05:11', NULL, 1, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `security_logs`
--

CREATE TABLE `security_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `event_type` enum('login_success','login_failed','account_locked','password_change','unauthorized_access') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `createdAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `security_logs`
--

INSERT INTO `security_logs` (`id`, `user_id`, `event_type`, `ip_address`, `details`, `createdAt`) VALUES
(1, 2, 'login_success', NULL, NULL, '2026-09-05 10:43:18'),
(2, 2, 'login_success', NULL, NULL, '2026-09-05 17:47:58'),
(3, 2, 'login_success', NULL, NULL, '2026-09-06 05:23:03'),
(4, 4, 'login_success', NULL, NULL, '2026-09-06 07:24:09'),
(5, 10, 'login_success', NULL, NULL, '2026-09-06 07:26:42'),
(6, 10, 'login_success', NULL, NULL, '2026-09-06 07:29:02'),
(7, 10, 'login_failed', NULL, '{\"attempts\":1}', '2026-09-06 09:32:39'),
(8, 10, 'login_success', NULL, NULL, '2026-09-06 09:32:48'),
(9, 4, 'login_success', NULL, NULL, '2026-09-06 09:34:33'),
(10, 4, 'login_success', NULL, NULL, '2026-09-06 15:22:37'),
(11, 4, 'login_success', NULL, NULL, '2026-09-06 15:24:13'),
(12, 10, 'login_success', NULL, NULL, '2026-09-06 15:30:53'),
(13, 2, 'login_success', NULL, NULL, '2026-09-09 05:32:13'),
(14, 2, 'login_success', NULL, NULL, '2026-09-12 14:13:16'),
(15, NULL, 'login_failed', NULL, '{\"email\":\"test_citizen@resqlink.gov.ph\",\"reason\":\"User not found\"}', '2026-09-12 14:50:45'),
(16, NULL, 'login_failed', NULL, '{\"email\":\"test_citizen@resqlink.gov.ph\",\"reason\":\"User not found\"}', '2026-09-12 14:51:19'),
(17, 20, 'login_success', NULL, NULL, '2026-09-12 14:51:20'),
(18, 4, 'login_success', NULL, NULL, '2026-09-12 14:51:20'),
(19, 14, 'login_success', NULL, NULL, '2026-09-12 14:51:20'),
(20, 12, 'login_success', NULL, NULL, '2026-09-12 14:51:20'),
(21, 20, 'login_success', NULL, NULL, '2026-09-12 14:52:49'),
(22, 4, 'login_success', NULL, NULL, '2026-09-12 14:52:49'),
(23, 14, 'login_success', NULL, NULL, '2026-09-12 14:52:49'),
(24, 12, 'login_success', NULL, NULL, '2026-09-12 14:52:50'),
(25, 20, 'login_success', NULL, NULL, '2026-09-12 14:53:02'),
(26, 4, 'login_success', NULL, NULL, '2026-09-12 14:53:02'),
(27, 14, 'login_success', NULL, NULL, '2026-09-12 14:53:02'),
(28, 12, 'login_success', NULL, NULL, '2026-09-12 14:53:02'),
(29, 20, 'login_success', NULL, NULL, '2026-09-12 14:53:48'),
(30, 4, 'login_success', NULL, NULL, '2026-09-12 14:53:48'),
(31, 14, 'login_success', NULL, NULL, '2026-09-12 14:53:48'),
(32, 12, 'login_success', NULL, NULL, '2026-09-12 14:53:48'),
(33, 4, 'login_success', NULL, NULL, '2026-09-12 15:20:06'),
(34, 1, 'login_success', NULL, NULL, '2026-09-12 15:25:30'),
(35, 4, 'login_success', NULL, NULL, '2026-09-12 15:45:42'),
(36, 4, 'login_success', NULL, NULL, '2026-09-12 15:46:37'),
(37, 4, 'login_success', NULL, NULL, '2026-09-12 15:47:10'),
(38, 4, 'login_success', NULL, NULL, '2026-09-12 15:47:53'),
(39, 4, 'login_success', NULL, NULL, '2026-09-12 15:48:56'),
(40, 2, 'login_success', NULL, NULL, '2026-09-12 15:48:56'),
(41, 1, 'login_success', NULL, NULL, '2026-09-12 15:48:56'),
(42, 4, 'login_success', NULL, NULL, '2026-09-12 15:49:25'),
(43, 2, 'login_success', NULL, NULL, '2026-09-12 15:49:25'),
(44, 1, 'login_success', NULL, NULL, '2026-09-12 15:49:26'),
(45, 4, 'login_success', NULL, NULL, '2026-09-12 15:49:50'),
(46, 2, 'login_success', NULL, NULL, '2026-09-12 15:49:51'),
(47, 1, 'login_success', NULL, NULL, '2026-09-12 15:49:51'),
(48, 20, 'login_success', NULL, NULL, '2026-09-12 16:40:57'),
(49, 4, 'login_success', NULL, NULL, '2026-09-12 16:40:57'),
(50, 14, 'login_success', NULL, NULL, '2026-09-12 16:40:57'),
(51, 12, 'login_success', NULL, NULL, '2026-09-12 16:40:58'),
(52, 4, 'login_success', NULL, NULL, '2026-09-12 16:42:25'),
(53, 2, 'login_success', NULL, NULL, '2026-09-12 16:42:25'),
(54, 1, 'login_success', NULL, NULL, '2026-09-12 16:42:26'),
(55, 1, 'login_success', NULL, NULL, '2026-09-12 16:42:39'),
(56, 2, 'login_success', NULL, NULL, '2026-09-12 16:45:32'),
(57, 1, 'login_success', NULL, NULL, '2026-09-12 16:45:38'),
(58, 2, 'login_success', NULL, NULL, '2026-09-16 07:46:08'),
(59, 4, 'login_success', NULL, NULL, '2026-09-16 07:50:09'),
(60, 2, 'login_success', NULL, NULL, '2026-09-16 07:50:19'),
(61, 4, 'login_success', NULL, NULL, '2026-09-16 07:50:29'),
(62, 4, 'login_success', NULL, NULL, '2026-09-16 07:53:09'),
(63, 4, 'login_success', NULL, NULL, '2026-09-16 07:53:43'),
(64, 10, 'login_failed', NULL, '{\"attempts\":1}', '2026-09-16 07:56:24'),
(65, 10, 'login_failed', NULL, '{\"attempts\":2}', '2026-09-16 07:57:25'),
(66, 10, 'login_failed', NULL, '{\"attempts\":3}', '2026-09-16 07:57:32'),
(67, 10, 'login_success', NULL, NULL, '2026-09-16 07:57:44'),
(68, 2, 'login_success', NULL, NULL, '2026-09-16 07:59:43'),
(69, 10, 'login_success', NULL, NULL, '2026-09-16 08:00:10'),
(70, 4, 'login_success', NULL, NULL, '2026-09-19 05:42:24'),
(71, 5, 'login_success', NULL, NULL, '2026-09-19 05:45:57'),
(72, 4, 'login_success', NULL, NULL, '2026-09-19 17:08:54'),
(73, 21, 'login_success', NULL, NULL, '2026-09-19 17:15:36'),
(74, 5, 'login_success', NULL, NULL, '2026-09-19 17:41:43'),
(75, 20, 'login_success', NULL, NULL, '2026-09-19 19:04:34'),
(76, 4, 'login_success', NULL, NULL, '2026-09-19 19:04:34'),
(77, 14, 'login_success', NULL, NULL, '2026-09-19 19:04:35'),
(78, 12, 'login_success', NULL, NULL, '2026-09-19 19:04:35'),
(79, 4, 'login_success', NULL, NULL, '2026-09-19 19:04:53'),
(80, 2, 'login_success', NULL, NULL, '2026-09-19 19:04:53'),
(81, 1, 'login_success', NULL, NULL, '2026-09-19 19:04:53'),
(82, 20, 'login_success', NULL, NULL, '2026-09-19 19:05:10'),
(83, 4, 'login_success', NULL, NULL, '2026-09-19 19:05:11'),
(84, 14, 'login_success', NULL, NULL, '2026-09-19 19:05:11'),
(85, 12, 'login_success', NULL, NULL, '2026-09-19 19:05:11'),
(86, 1, 'login_success', NULL, NULL, '2026-09-19 19:05:26');

-- --------------------------------------------------------

--
-- Table structure for table `skills`
--

CREATE TABLE `skills` (
  `id` int(11) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `skills`
--

INSERT INTO `skills` (`id`, `category_id`, `name`, `createdAt`, `updatedAt`) VALUES
(1, 1, 'Rough Carpentry', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(2, 1, 'Concrete Masonry', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(3, 1, 'TIG/MIG Welding', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(4, 1, 'House Painting', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(5, 2, 'Residential Wiring', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(6, 2, 'Pipe Installation', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(7, 2, 'Circuit Troubleshooting', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(8, 3, '6-Wheel Truck Driving', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(9, 3, 'Forklift Operation', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(10, 3, 'Motorcycle Express Delivery', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(11, 4, 'CCTV Monitoring', '2026-08-30 14:15:39', '2026-08-30 14:15:39'),
(12, 4, 'Building Security', '2026-08-30 14:15:39', '2026-08-30 14:15:39');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('citizen','mdrrmo_admin','pnp_responder','bfp_responder','super_admin','admin','sub_admin','user','employer','employee','responder') NOT NULL DEFAULT 'citizen',
  `is_verified` tinyint(1) DEFAULT 0,
  `verification_status` enum('unverified','pending_ai','pending_admin','approved','rejected') DEFAULT 'unverified',
  `is_active` tinyint(1) DEFAULT 1,
  `failed_login_attempts` int(11) DEFAULT 0,
  `lockout_until` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `refresh_token` text DEFAULT NULL,
  `account_status` enum('ACTIVE','SUSPENDED','BLOCKED') DEFAULT 'ACTIVE',
  `penalty_balance` decimal(10,2) DEFAULT 0.00,
  `suspension_ends_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `agency` enum('MDRRMO','PNP','BFP','CITIZEN','NONE','Medical','Police','Fire','Rescue') DEFAULT 'CITIZEN',
  `badge_or_unit_id` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `uuid`, `email`, `phone_number`, `password_hash`, `role`, `is_verified`, `verification_status`, `is_active`, `failed_login_attempts`, `lockout_until`, `last_login_at`, `refresh_token`, `account_status`, `penalty_balance`, `suspension_ends_at`, `createdAt`, `updatedAt`, `agency`, `badge_or_unit_id`) VALUES
(1, '16dfe7c9-e152-4aa5-a6b4-12a4694ca98b', 'superadmin@resqlink.gov.ph', '0917-100-0000', '$2a$10$lin/6lMjwqFtKApYZyst7OU0NEfv6RBb8S9QrC2bqC6X43EixJxwy', 'super_admin', 1, 'approved', 1, 0, NULL, '2026-09-19 19:05:26', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXVpZCI6IjE2ZGZlN2M5LWUxNTItNGFhNS1hNmI0LTEyYTQ2OTRjYTk4YiIsImlhdCI6MTc4OTg0NDcyNiwiZXhwIjoxNzkwNDQ5NTI2fQ.AypdfJP-BCZgAHUg9_VoysiVwe2A2Cb7ywr1ixePJd4', 'ACTIVE', 0.00, NULL, '2026-09-05 07:43:03', '2026-09-19 19:05:26', 'CITIZEN', NULL),
(2, 'd8faec28-c18e-4f9d-9516-ea5665aa09bd', 'admin.porac@resqlink.gov.ph', '0917-200-0001', '$2a$10$lin/6lMjwqFtKApYZyst7OU0NEfv6RBb8S9QrC2bqC6X43EixJxwy', 'admin', 1, 'approved', 1, 0, NULL, '2026-09-19 19:04:53', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXVpZCI6ImQ4ZmFlYzI4LWMxOGUtNGY5ZC05NTE2LWVhNTY2NWFhMDliZCIsImlhdCI6MTc4OTg0NDY5MywiZXhwIjoxNzkwNDQ5NDkzfQ.wmXaDxDMZMDPrO4dL7pNzNbv6InUCJ3RnCe1e-rvQCo', 'ACTIVE', 0.00, NULL, '2026-09-05 07:43:03', '2026-09-19 19:04:53', 'CITIZEN', NULL),
(3, '41819001-a20d-4467-8807-eaa2e9d7894d', 'subadmin.porac@resqlink.gov.ph', '0917-200-0002', '$2a$10$lin/6lMjwqFtKApYZyst7OU0NEfv6RBb8S9QrC2bqC6X43EixJxwy', 'sub_admin', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'CITIZEN', NULL),
(4, '8d7c1c75-ebd8-4279-bf43-b5e7ed90643c', 'admin.santarita@resqlink.gov.ph', '0917-300-0001', '$2a$10$lin/6lMjwqFtKApYZyst7OU0NEfv6RBb8S9QrC2bqC6X43EixJxwy', 'admin', 1, 'approved', 1, 0, NULL, '2026-09-19 19:05:11', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwidXVpZCI6IjhkN2MxYzc1LWViZDgtNDI3OS1iZjQzLWI1ZTdlZDkwNjQzYyIsImlhdCI6MTc4OTg0NDcxMSwiZXhwIjoxNzkwNDQ5NTExfQ.d1vviSvKil6dFwnCHmbxfnhN7PE-wCcLEEByBP9TfuI', 'ACTIVE', 0.00, NULL, '2026-09-05 07:43:03', '2026-09-19 19:05:11', 'CITIZEN', NULL),
(5, '1205a96c-623f-4ef9-8b27-86eefc444d86', 'subadmin.santarita@resqlink.gov.ph', '0917-300-0002', '$2a$10$lin/6lMjwqFtKApYZyst7OU0NEfv6RBb8S9QrC2bqC6X43EixJxwy', 'sub_admin', 1, 'approved', 1, 0, NULL, '2026-09-19 17:41:43', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXVpZCI6IjEyMDVhOTZjLTYyM2YtNGVmOS04YjI3LTg2ZWVmYzQ0NGQ4NiIsImlhdCI6MTc4OTgzOTcwMywiZXhwIjoxNzkwNDQ0NTAzfQ.RLip2qZspMIngGvLu-s_7HCEk-0dnCpmMlaygqHAg_Q', 'ACTIVE', 0.00, NULL, '2026-09-05 07:43:03', '2026-09-19 17:41:43', 'CITIZEN', NULL),
(6, 'bee18c42-dfab-4123-8e36-a6adfb8ae90b', 'admin.guagua@resqlink.gov.ph', '0917-400-0001', '$2a$10$lin/6lMjwqFtKApYZyst7OU0NEfv6RBb8S9QrC2bqC6X43EixJxwy', 'admin', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'CITIZEN', NULL),
(7, 'ad0a73f5-e64c-42ac-83b7-7769b2f80eab', 'subadmin.guagua@resqlink.gov.ph', '0917-400-0002', '$2a$10$lin/6lMjwqFtKApYZyst7OU0NEfv6RBb8S9QrC2bqC6X43EixJxwy', 'sub_admin', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-05 07:43:03', '2026-09-05 07:43:03', 'CITIZEN', NULL),
(10, 'b5301ec8-79be-46e6-8385-d824accab03c', 'c@gmail.com', '09563304749', '$2a$12$lNZi10fx2t3wImCfc4c1lOu9YX5R4l/3334O1wtGB0cK7bUb34HLy', 'user', 1, 'approved', 0, 0, NULL, '2026-09-16 08:00:10', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTAsInV1aWQiOiJiNTMwMWVjOC03OWJlLTQ2ZTYtODM4NS1kODI0YWNjYWIwM2MiLCJpYXQiOjE3ODk1NDU2MTAsImV4cCI6MTc5MDE1MDQxMH0._QIaMvh79DJ9QIkggEAzxe6Xz7pyq1P43ZGy9jwIfGA', 'ACTIVE', 0.00, NULL, '2026-09-06 07:26:34', '2026-09-19 17:12:46', 'CITIZEN', NULL),
(11, 'd7593d12-de19-4a95-8984-8554f84fb52f', 'medic.porac@resqlink.gov.ph', '0917-210-0001', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Medical', 'MED-POR-01'),
(12, '6d855fc9-a43b-472b-bc73-9c64d140baea', 'police.porac@resqlink.gov.ph', '0917-210-0002', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, '2026-09-19 19:05:11', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIsInV1aWQiOiI2ZDg1NWZjOS1hNDNiLTQ3MmItYmM3My05YzY0ZDE0MGJhZWEiLCJpYXQiOjE3ODk4NDQ3MTEsImV4cCI6MTc5MDQ0OTUxMX0.6cPA6PXvsxp-9ZGxrctC7OK9Xr_iiuf6206OGs5YrJI', 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-19 19:05:11', 'Police', 'PNP-POR-101'),
(13, '9e249d8d-82c3-4da4-aa47-397cd79476a3', 'fire.porac@resqlink.gov.ph', '0917-210-0003', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Fire', 'BFP-POR-201'),
(14, '39fefa60-d1a4-4a5b-abab-6977fafd3c94', 'medic.santarita@resqlink.gov.ph', '0917-310-0001', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, '2026-09-19 19:05:11', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTQsInV1aWQiOiIzOWZlZmE2MC1kMWE0LTRhNWItYWJhYi02OTc3ZmFmZDNjOTQiLCJpYXQiOjE3ODk4NDQ3MTEsImV4cCI6MTc5MDQ0OTUxMX0.BO1FhLnSe1vy1V1kfwoorBO45Cx5HZDaeuDWbJzHOi0', 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-19 19:05:11', 'Medical', 'MED-STR-01'),
(15, '157a3a0b-417b-4dd4-9f8e-18c8e6280ba3', 'police.santarita@resqlink.gov.ph', '0917-310-0002', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Police', 'PNP-STR-101'),
(16, 'aa2ca6c3-f541-4d53-8182-3c64b979d596', 'fire.santarita@resqlink.gov.ph', '0917-310-0003', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Fire', 'BFP-STR-201'),
(17, '18365f51-2114-48c3-854b-6d7975d8784f', 'medic.guagua@resqlink.gov.ph', '0917-410-0001', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Medical', 'MED-GUA-01'),
(18, 'abb514f6-b89b-4c97-9c91-0bf792537776', 'police.guagua@resqlink.gov.ph', '0917-410-0002', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Police', 'PNP-GUA-101'),
(19, 'a0bc38ab-1965-4450-924a-11d72251b91d', 'fire.guagua@resqlink.gov.ph', '0917-410-0003', '$2a$10$GlwUOWwRbViK6ar2ubHr0OEFlyuRjpBnWTHV5DKvE6E2IWF/mUfvm', 'responder', 1, 'approved', 1, 0, NULL, NULL, NULL, 'ACTIVE', 0.00, NULL, '2026-09-12 14:43:15', '2026-09-12 14:43:15', 'Fire', 'BFP-GUA-201'),
(20, '92703655-1466-49f1-8d5b-5ee948854442', 'test_citizen@resqlink.gov.ph', '09123456789', '$2a$10$2vsYSbJ9mqISvysT03KSN.ktyfBAp98mXrKs7he2rPw38ruV9BQqK', 'user', 1, 'approved', 1, 0, NULL, '2026-09-19 19:05:10', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsInV1aWQiOiI5MjcwMzY1NS0xNDY2LTQ5ZjEtOGQ1Yi01ZWU5NDg4NTQ0NDIiLCJpYXQiOjE3ODk4NDQ3MTAsImV4cCI6MTc5MDQ0OTUxMH0.0yVaN2PJXLX2U_J_Y6a5mS2TxFNAA9h0A8_uvmJvYB0', 'ACTIVE', 0.00, NULL, '2026-09-12 14:51:20', '2026-09-19 19:05:10', 'CITIZEN', NULL),
(21, '1eb463a0-def0-456f-b7da-0f448b773aa2', 'b@gmail.com', '09488988741', '$2a$10$7ibBjT1CgJ2.aw1Z2Oh1UO56EUQAfEBtUAu44e8tMiiZ9davx5ARS', 'citizen', 1, 'approved', 1, 0, NULL, '2026-09-19 17:15:36', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjEsInV1aWQiOiIxZWI0NjNhMC1kZWYwLTQ1NmYtYjdkYS0wZjQ0OGI3NzNhYTIiLCJpYXQiOjE3ODk4MzgxMzYsImV4cCI6MTc5MDQ0MjkzNn0.coUIWBepji8Q27yXO5P55hYeXwPRfYFWp6AXTNV0Ntg', 'ACTIVE', 0.00, NULL, '2026-09-19 17:15:27', '2026-09-19 17:15:36', 'CITIZEN', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `verification_requests`
--

CREATE TABLE `verification_requests` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `id_type` varchar(100) NOT NULL,
  `extracted_id_num` varchar(100) DEFAULT NULL,
  `extracted_name` varchar(255) DEFAULT NULL,
  `id_image_url` varchar(255) NOT NULL,
  `id_back_image` varchar(255) DEFAULT NULL,
  `live_selfie_url` varchar(255) DEFAULT NULL,
  `business_permit_image` varchar(255) DEFAULT NULL,
  `ocr_extracted_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ocr_extracted_data`)),
  `facial_match_score` float DEFAULT 0,
  `quality_score` float DEFAULT 0,
  `duplicate_flag` tinyint(1) DEFAULT 0,
  `ai_confidence` float DEFAULT NULL,
  `ai_recommendation` varchar(255) DEFAULT NULL,
  `status` enum('PENDING_ADMIN_APPROVAL','APPROVED','REJECTED') DEFAULT 'PENDING_ADMIN_APPROVAL',
  `admin_notes` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `complaints`
--
ALTER TABLE `complaints`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reporter_id` (`reporter_id`),
  ADD KEY `reported_user_id` (`reported_user_id`),
  ADD KEY `job_id` (`job_id`);

--
-- Indexes for table `completed_jobs`
--
ALTER TABLE `completed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `application_id` (`application_id`),
  ADD KEY `job_id` (`job_id`),
  ADD KEY `employer_id` (`employer_id`),
  ADD KEY `employee_id` (`employee_id`);

--
-- Indexes for table `conversations`
--
ALTER TABLE `conversations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `participant1_id` (`participant1_id`),
  ADD KEY `participant2_id` (`participant2_id`),
  ADD KEY `job_id` (`job_id`),
  ADD KEY `application_id` (`application_id`);

--
-- Indexes for table `employer_profiles`
--
ALTER TABLE `employer_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- Indexes for table `incident_tracking_logs`
--
ALTER TABLE `incident_tracking_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `incident_id` (`incident_id`),
  ADD KEY `actor_id` (`actor_id`);

--
-- Indexes for table `interviews`
--
ALTER TABLE `interviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `application_id` (`application_id`),
  ADD KEY `job_id` (`job_id`),
  ADD KEY `employer_id` (`employer_id`),
  ADD KEY `employee_id` (`employee_id`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD KEY `employer_id` (`employer_id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `job_applications`
--
ALTER TABLE `job_applications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `job_id` (`job_id`),
  ADD KEY `employee_id` (`employee_id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `conversation_id` (`conversation_id`),
  ADD KEY `sender_id` (`sender_id`),
  ADD KEY `receiver_id` (`receiver_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sender_id` (`sender_id`),
  ADD KEY `receiver_id` (`receiver_id`),
  ADD KEY `booking_id` (`booking_id`);

--
-- Indexes for table `pampanga_barangays`
--
ALTER TABLE `pampanga_barangays`
  ADD PRIMARY KEY (`id`),
  ADD KEY `town_id` (`town_id`);

--
-- Indexes for table `pampanga_locations`
--
ALTER TABLE `pampanga_locations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `pampanga_towns`
--
ALTER TABLE `pampanga_towns`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `town_name` (`town_name`);

--
-- Indexes for table `penalties`
--
ALTER TABLE `penalties`
  ADD PRIMARY KEY (`id`),
  ADD KEY `report_id` (`report_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `issued_by` (`issued_by`);

--
-- Indexes for table `profiles`
--
ALTER TABLE `profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `pampanga_town_id` (`pampanga_town_id`);

--
-- Indexes for table `public_alerts`
--
ALTER TABLE `public_alerts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `uuid_2` (`uuid`),
  ADD KEY `author_id` (`author_id`);

--
-- Indexes for table `ratings`
--
ALTER TABLE `ratings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `job_id` (`job_id`),
  ADD KEY `rater_id` (`rater_id`),
  ADD KEY `ratee_id` (`ratee_id`);

--
-- Indexes for table `resq_requests`
--
ALTER TABLE `resq_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `uuid_2` (`uuid`),
  ADD UNIQUE KEY `uuid_3` (`uuid`),
  ADD KEY `resq_requests_assigned_subadmin_id_foreign_idx` (`assigned_subadmin_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `assigned_responder_id` (`assigned_responder_id`);

--
-- Indexes for table `security_logs`
--
ALTER TABLE `security_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `skills`
--
ALTER TABLE `skills`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uuid_2` (`uuid`),
  ADD UNIQUE KEY `email_2` (`email`),
  ADD UNIQUE KEY `uuid_3` (`uuid`),
  ADD UNIQUE KEY `email_3` (`email`);

--
-- Indexes for table `verification_requests`
--
ALTER TABLE `verification_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `complaints`
--
ALTER TABLE `complaints`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `completed_jobs`
--
ALTER TABLE `completed_jobs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `conversations`
--
ALTER TABLE `conversations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employer_profiles`
--
ALTER TABLE `employer_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `incident_tracking_logs`
--
ALTER TABLE `incident_tracking_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=92;

--
-- AUTO_INCREMENT for table `interviews`
--
ALTER TABLE `interviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `job_applications`
--
ALTER TABLE `job_applications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `pampanga_barangays`
--
ALTER TABLE `pampanga_barangays`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pampanga_locations`
--
ALTER TABLE `pampanga_locations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pampanga_towns`
--
ALTER TABLE `pampanga_towns`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `penalties`
--
ALTER TABLE `penalties`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `profiles`
--
ALTER TABLE `profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `public_alerts`
--
ALTER TABLE `public_alerts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `ratings`
--
ALTER TABLE `ratings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `resq_requests`
--
ALTER TABLE `resq_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `security_logs`
--
ALTER TABLE `security_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=87;

--
-- AUTO_INCREMENT for table `skills`
--
ALTER TABLE `skills`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `verification_requests`
--
ALTER TABLE `verification_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `complaints`
--
ALTER TABLE `complaints`
  ADD CONSTRAINT `complaints_ibfk_1` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `complaints_ibfk_2` FOREIGN KEY (`reported_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `complaints_ibfk_3` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `completed_jobs`
--
ALTER TABLE `completed_jobs`
  ADD CONSTRAINT `completed_jobs_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `completed_jobs_ibfk_2` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `completed_jobs_ibfk_3` FOREIGN KEY (`employer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `completed_jobs_ibfk_4` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `conversations`
--
ALTER TABLE `conversations`
  ADD CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`participant1_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `conversations_ibfk_2` FOREIGN KEY (`participant2_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `conversations_ibfk_3` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `conversations_ibfk_4` FOREIGN KEY (`application_id`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `employer_profiles`
--
ALTER TABLE `employer_profiles`
  ADD CONSTRAINT `employer_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `incident_tracking_logs`
--
ALTER TABLE `incident_tracking_logs`
  ADD CONSTRAINT `incident_tracking_logs_ibfk_3` FOREIGN KEY (`incident_id`) REFERENCES `resq_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `incident_tracking_logs_ibfk_4` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `interviews`
--
ALTER TABLE `interviews`
  ADD CONSTRAINT `interviews_ibfk_1` FOREIGN KEY (`application_id`) REFERENCES `job_applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `interviews_ibfk_2` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `interviews_ibfk_3` FOREIGN KEY (`employer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `interviews_ibfk_4` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `jobs`
--
ALTER TABLE `jobs`
  ADD CONSTRAINT `jobs_ibfk_1` FOREIGN KEY (`employer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `jobs_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `job_applications`
--
ALTER TABLE `job_applications`
  ADD CONSTRAINT `job_applications_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `job_applications_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_3` FOREIGN KEY (`booking_id`) REFERENCES `job_applications` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `pampanga_barangays`
--
ALTER TABLE `pampanga_barangays`
  ADD CONSTRAINT `pampanga_barangays_ibfk_1` FOREIGN KEY (`town_id`) REFERENCES `pampanga_towns` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `penalties`
--
ALTER TABLE `penalties`
  ADD CONSTRAINT `penalties_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `complaints` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `penalties_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `penalties_ibfk_3` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `profiles`
--
ALTER TABLE `profiles`
  ADD CONSTRAINT `profiles_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `profiles_ibfk_4` FOREIGN KEY (`pampanga_town_id`) REFERENCES `pampanga_towns` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `public_alerts`
--
ALTER TABLE `public_alerts`
  ADD CONSTRAINT `public_alerts_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `ratings`
--
ALTER TABLE `ratings`
  ADD CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ratings_ibfk_2` FOREIGN KEY (`rater_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ratings_ibfk_3` FOREIGN KEY (`ratee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `resq_requests`
--
ALTER TABLE `resq_requests`
  ADD CONSTRAINT `resq_requests_assigned_subadmin_id_foreign_idx` FOREIGN KEY (`assigned_subadmin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `resq_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `resq_requests_ibfk_2` FOREIGN KEY (`assigned_responder_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `skills`
--
ALTER TABLE `skills`
  ADD CONSTRAINT `skills_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `verification_requests`
--
ALTER TABLE `verification_requests`
  ADD CONSTRAINT `verification_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

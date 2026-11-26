-- MySQL / MariaDB Schema for Employee Mission Order Management System (XAMPP)
-- Import this file via phpMyAdmin or the mysql CLI.

CREATE DATABASE IF NOT EXISTS `odm_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `odm_db`;

CREATE TABLE IF NOT EXISTS `employees` (
  `id` CHAR(36) NOT NULL,
  `first_name` VARCHAR(255) NOT NULL,
  `last_name` VARCHAR(255) NOT NULL,
  `position` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_employees_last_name` (`last_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` CHAR(36) NOT NULL,
  `model` VARCHAR(255) NOT NULL,
  `registration_plate` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_vehicles_model` (`model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_projects_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mission_orders` (
  `id` CHAR(36) NOT NULL,
  `order_number` VARCHAR(50) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `vehicle_id` CHAR(36) NOT NULL,
  `project_id` CHAR(36) NULL,
  `destination` VARCHAR(255) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('draft', 'issued', 'archived') NOT NULL DEFAULT 'issued',
  `authorized_by` ENUM('operations', 'administration') NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mission_orders_order_number` (`order_number`),
  INDEX `idx_mission_orders_employee_id` (`employee_id`),
  INDEX `idx_mission_orders_vehicle_id` (`vehicle_id`),
  INDEX `idx_mission_orders_project_id` (`project_id`),
  INDEX `idx_mission_orders_start_date` (`start_date`),
  CONSTRAINT `fk_mission_orders_employee`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_mission_orders_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_mission_orders_project`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `admin_password_hash` VARCHAR(255) NULL,
  `admin_password_set_at` TIMESTAMP NULL,
  `session_secret` VARCHAR(128) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_app_settings_singleton` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `app_settings` (`id`, `admin_password_hash`, `admin_password_set_at`)
VALUES (1, NULL, NULL);

CREATE TABLE IF NOT EXISTS `order_sequences` (
  `year_num` SMALLINT UNSIGNED NOT NULL,
  `last_seq` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`year_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

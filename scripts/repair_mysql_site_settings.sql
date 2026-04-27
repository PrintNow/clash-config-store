-- 手动修复：当 site_settings 表不存在但应用已启动过时的漂移
-- 用法：mysql -u... -p clash_config_store < scripts/repair_mysql_site_settings.sql

CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key` varchar(191) NOT NULL,
  `value` longtext NOT NULL,
  PRIMARY KEY (`setting_key`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `site_settings` (`setting_key`, `value`) VALUES ('allow_registration', 'false');

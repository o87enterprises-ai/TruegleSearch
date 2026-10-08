-- Owner audit, 2026-10-08: votes no longer hide anything from everyone (see
-- NO ONE CAN HIDE A VIDEO FROM EVERYONE in services/MediaService.js). Put back
-- every row that was hidden by 👎 alone; rows with "broken" reports stay for
-- the service to re-check against the platform.
UPDATE media_signals SET hidden = FALSE WHERE hidden = TRUE AND broken < 2;

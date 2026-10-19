-- Tambah kolom penanda perubahan password. Token sesi yang diterbitkan sebelum
-- waktu ini dianggap tidak berlaku, sehingga rotasi password memutus sesi lama.
ALTER TABLE "AdminUser" ADD COLUMN "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- MIGRATION 1: add_reference_material_role
-- Adiciona o valor REFERENCE_MATERIAL ao enum MaterialRole
ALTER TYPE "MaterialRole" ADD VALUE IF NOT EXISTS 'REFERENCE_MATERIAL';

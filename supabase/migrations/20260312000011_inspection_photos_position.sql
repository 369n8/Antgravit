ALTER TABLE inspection_photos
ADD COLUMN IF NOT EXISTS position TEXT CHECK (position IN ('frente', 'traseira', 'lateral_esq', 'lateral_dir', 'dano', 'interior', 'outro'));

ALTER TABLE inspection_photos
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;

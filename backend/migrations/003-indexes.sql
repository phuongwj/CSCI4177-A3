-- Up Migration

CREATE INDEX idx_group_members_group_user_role ON group_members(group_id, user_id, role);
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_groups_created_at ON groups(created_at DESC);

-- Down Migration

DROP INDEX IF EXISTS idx_groups_created_at;
DROP INDEX IF EXISTS idx_groups_created_by;
DROP INDEX IF EXISTS idx_group_members_group_user_role;

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/mlog"
	"github.com/mattermost/focalboard/server/utils"

	sq "github.com/Masterminds/squirrel"
)

func (s *SQLStore) UpsertWorkspaceSignupToken(workspace model.Workspace) error {
	now := time.Now().Unix()

	query := s.getQueryBuilder().
		Insert(s.tablePrefix+"workspaces").
		Columns(
			"id",
			"signup_token",
			"modified_by",
			"update_at",
		).
		Values(
			workspace.ID,
			workspace.SignupToken,
			workspace.ModifiedBy,
			now,
		)
	if s.dbType == mysqlDBType {
		query = query.Suffix("ON DUPLICATE KEY UPDATE signup_token = ?, modified_by = ?, update_at = ?",
			workspace.SignupToken, workspace.ModifiedBy, now)
	} else {
		query = query.Suffix(
			`ON CONFLICT (id)
			 DO UPDATE SET signup_token = EXCLUDED.signup_token, modified_by = EXCLUDED.modified_by, update_at = EXCLUDED.update_at`,
		)
	}

	_, err := query.Exec()
	return err
}

func (s *SQLStore) UpsertWorkspaceSettings(workspace model.Workspace) error {
	now := time.Now().Unix()
	signupToken := utils.CreateGUID()

	settingsJSON, err := json.Marshal(workspace.Settings)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder().
		Insert(s.tablePrefix+"workspaces").
		Columns(
			"id",
			"signup_token",
			"settings",
			"modified_by",
			"update_at",
		).
		Values(
			workspace.ID,
			signupToken,
			settingsJSON,
			workspace.ModifiedBy,
			now,
		)
	if s.dbType == mysqlDBType {
		query = query.Suffix("ON DUPLICATE KEY UPDATE settings = ?, modified_by = ?, update_at = ?", settingsJSON, workspace.ModifiedBy, now)
	} else {
		query = query.Suffix(
			`ON CONFLICT (id)
			 DO UPDATE SET settings = EXCLUDED.settings, modified_by = EXCLUDED.modified_by, update_at = EXCLUDED.update_at`,
		)
	}

	_, err = query.Exec()
	return err
}

func (s *SQLStore) GetWorkspace(id string) (*model.Workspace, error) {
	var settingsJSON string

	query := s.getQueryBuilder().
		Select(
			"id",
			"signup_token",
			"COALESCE(settings, '{}')",
			"modified_by",
			"update_at",
		).
		From(s.tablePrefix + "workspaces").
		Where(sq.Eq{"id": id})
	row := query.QueryRow()
	workspace := model.Workspace{}

	err := row.Scan(
		&workspace.ID,
		&workspace.SignupToken,
		&settingsJSON,
		&workspace.ModifiedBy,
		&workspace.UpdateAt,
	)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal([]byte(settingsJSON), &workspace.Settings)
	if err != nil {
		s.logger.Error(`ERROR GetWorkspace settings json.Unmarshal`, mlog.Err(err))
		return nil, err
	}

	return &workspace, nil
}

func (s *SQLStore) HasWorkspaceAccess(userID string, workspaceID string) (bool, error) {
	return true, nil
}

func (s *SQLStore) GetWorkspaceCount() (int64, error) {
	query := s.getQueryBuilder().
		Select(
			"COUNT(*) AS count",
		).
		From(s.tablePrefix + "workspaces")

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("ERROR GetWorkspaceCount", mlog.Err(err))
		return 0, err
	}
	defer s.CloseRows(rows)

	var count int64

	rows.Next()
	err = rows.Scan(&count)
	if err != nil {
		s.logger.Error("Failed to fetch workspace count", mlog.Err(err))
		return 0, err
	}
	return count, nil
}

func (s *SQLStore) GetUserWorkspaces(userID string) ([]model.UserWorkspace, error) {
	var query sq.SelectBuilder

	if s.dbType == mysqlDBType {
		query = s.getQueryBuilder().
			Select("Channels.ID", "Channels.DisplayName", "COUNT(focalboard_blocks.id)").
			From("focalboard_blocks").
			Join("ChannelMembers ON focalboard_blocks.workspace_id = ChannelMembers.ChannelId").
			Join("Channels ON ChannelMembers.ChannelId = Channels.Id").
			Where("ChannelMembers.UserId = ?", userID).
			Where("focalboard_blocks.type = 'board'").
			Where("focalboard_blocks.fields LIKE '%\"isTemplate\":false%'").
			GroupBy("Channels.Id", "Channels.DisplayName")
	} else {
		query = s.getQueryBuilder().
			Select("channels.id", "channels.displayname", "count(focalboard_blocks.id)").
			From("focalboard_blocks").
			Join("channelmembers ON focalboard_blocks.workspace_id = channelmembers.channelid").
			Join("channels ON channelmembers.channelid = channels.id").
			Where("channelmembers.userid = ?", userID).
			Where("focalboard_blocks.type = 'board'").
			Where("focalboard_blocks.fields ->> 'isTemplate' = 'false'").
			GroupBy("channels.id", "channels.displayname")
	}

	rows, err := query.Query()

	if err != nil {
		s.logger.Error("ERROR GetUserWorkspaces", mlog.Err(err))
		return nil, err
	}

	defer s.CloseRows(rows)
	return s.userWorkspacesFromRoes(rows)
}

func (s *SQLStore) userWorkspacesFromRoes(rows *sql.Rows) ([]model.UserWorkspace, error) {
	userWorkspaces := []model.UserWorkspace{}

	for rows.Next() {
		var userWorkspace model.UserWorkspace

		err := rows.Scan(
			&userWorkspace.ID,
			&userWorkspace.Title,
			&userWorkspace.BoardCount,
		)

		if err != nil {
			s.logger.Error("ERROR userWorkspacesFromRoes", mlog.Err(err))
			return nil, err
		}

		userWorkspaces = append(userWorkspaces, userWorkspace)
	}

	return userWorkspaces, nil
}

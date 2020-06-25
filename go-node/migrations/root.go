package migrations

import (
	"sort"
)

var _migrations []*Migration

func sortMigrations() {
	sort.Slice(_migrations, func(i, j int) bool {
		return _migrations[i].ID < _migrations[j].ID
	})
}

func addMigration(m *Migration) {
	_migrations = append(_migrations, m)
	sortMigrations()
}

// GetMigrations returns all migrations
func GetMigrations() []*Migration {
	return _migrations
}

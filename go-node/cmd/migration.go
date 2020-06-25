package main

import (
	"bytes"
	"fmt"
	"html/template"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	db "github.com/BOPR/core"
	"github.com/BOPR/migrations"
	"github.com/spf13/cobra"
	"github.com/tendermint/tendermint/libs/common"
)

var migrationTemplate *template.Template

const (
	downToFlag         = "to"
	downAllFlag        = "all"
	createFileNameFlag = "filename"
)

func init() {
	var err error
	if migrationTemplate, err = template.New("migrationFileTemplate").Parse(defaultMigrationFileTemplate); err != nil {
		panic(err)
	}

	// add flags to down migration
	downMigrateCmd.Flags().Bool(downAllFlag, false, "Rollback to last migration")
	downMigrateCmd.Flags().String(downToFlag, "", "Rollback untill specified migration")

	// // add flags to create migration
	createMigrateCmd.Flags().String(createFileNameFlag, "migration", "Migration filename")

	// // add sub-commands to migrate
	migrationCmd.AddCommand(upMigrateCmd, downMigrateCmd, createMigrateCmd)

}

// MigrationTemplate migration template
type MigrationTemplate struct {
	ID string
}

// migrationCmd represents the migrate command
var migrationCmd = &cobra.Command{
	Use:   "migration",
	Short: "Run migration for Hermione",
	Run:   nil,
}

// upMigrateCmd represents the up migrate command
var upMigrateCmd = &cobra.Command{
	Use:   "up",
	Short: "Run up migration",
	RunE: func(cmd *cobra.Command, args []string) error {
		db, err := db.NewDB()
		if err != nil {
			return err
		}
		defer db.Close()

		allMigrations := migrations.GetMigrations()
		m := migrations.NewGormigrate(db.Instance, migrations.DefaultOptions, allMigrations)
		return m.Migrate()
	},
}

// downMigrateCmd represents the up migrate command
var downMigrateCmd = &cobra.Command{
	Use:   "down",
	Short: "Run down migration",
	RunE: func(cmd *cobra.Command, args []string) error {
		db, err := db.NewDB()
		if err != nil {
			return err
		}
		defer db.Close()

		// fetch all migrations
		allMigrations := migrations.GetMigrations()
		// create migration object
		m := migrations.NewGormigrate(db.Instance, migrations.DefaultOptions, allMigrations)

		if _, err := cmd.Flags().GetBool(downAllFlag); err == nil {
			for _, d := range allMigrations {
				if err := m.RollbackMigration(d); err != nil {
					return err
				}
			}

			return nil
		} else if toValue, err := cmd.Flags().GetString(downToFlag); err == nil {
			// rollback till last migration
			return m.RollbackTo(toValue)
		}

		// rollback to last migration
		return m.RollbackLast()
	},
}

// createMigrateCmd represents the create command for migration
var createMigrateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create migration file",
	RunE: func(cmd *cobra.Command, args []string) error {
		// create timestamp prefix
		prefix := time.Now().Unix()

		// fetch token name
		suffix, _ := cmd.Flags().GetString(createFileNameFlag)
		suffix = strings.Trim(suffix, " ")
		suffix = strings.Replace(suffix, " ", "_", -1)
		suffix = strings.ToLower(suffix)

		// draft filename
		fileName := fmt.Sprintf("%s_%s.go", strconv.FormatInt(prefix, 10), suffix)
		currentDir, _ := filepath.Abs("./")
		fp := path.Join(currentDir, "migrations", fileName)

		// write migration file
		return writeMigrationFile(fp, &MigrationTemplate{
			ID: strconv.FormatInt(prefix, 10),
		})
	},
}

// func getDB() (*gorm.DB, error) {
// 	dbConf := config.GlobalCfg
// 	db, err := gorm.Open(dbConf.DB, dbConf.FormattedDBURL())
// 	if err != nil {
// 		return nil, err
// 	}
// 	db.LogMode(true)
// 	return db, nil
// }

// func closeDB(db *gorm.DB) {
// 	db.Close()
// }

func writeMigrationFile(filePath string, m *MigrationTemplate) error {
	var buffer bytes.Buffer
	if err := migrationTemplate.Execute(&buffer, m); err != nil {
		panic(err)
	}

	return common.WriteFile(filePath, buffer.Bytes(), 0644)
}

const defaultMigrationFileTemplate = `
package migrations

import (
	"github.com/jinzhu/gorm"
)

func init() {
	m := &Migration{
		ID: "{{ .ID }}",
		Up: func(*gorm.DB) error {
			// TODO add up migration here
			return nil
		},
		Down: func(*gorm.DB) error {
			// TODO add down migration here
			return nil
		},
	}

	// add migration to list
	addMigration(m)
}
`

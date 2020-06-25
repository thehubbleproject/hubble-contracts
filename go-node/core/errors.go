package core

import (
	"fmt"
)

func ErrRecordNotFound(msg string) error {
	return fmt.Errorf("Error: Record not found. Msg: %s", msg)
}

func GenericError(msg string) error {
	return fmt.Errorf("Error: %v", msg)
}

func ErrUnableToCreateRecord(msg string) error {
	return fmt.Errorf("Error: Unable to crete record. Msg: %s", msg)
}

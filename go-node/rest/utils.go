package rest

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

// ReadRESTReq reads and unmarshals a Request's body to the the BaseReq stuct.
// Writes an error response to ResponseWriter and returns true if errors occurred.
func ReadRESTReq(w http.ResponseWriter, r *http.Request, req interface{}) bool {
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, err.Error())
		return false
	}

	err = json.Unmarshal(body, req)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, fmt.Sprintf("failed to decode JSON payload: %s", err))
		return false
	}

	return true
}

type ErrorResponse struct {
	Code  int    `json:"code,omitempty"`
	Error string `json:"error"`
}

// NewErrorResponse creates a new ErrorResponse instance.
func NewErrorResponse(code int, err string) ErrorResponse {
	return ErrorResponse{Code: code, Error: err}
}

// WriteErrorResponse prepares and writes a HTTP error
// given a status code and an error message.
func WriteErrorResponse(w http.ResponseWriter, status int, err string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(MustMarshallJSON(NewErrorResponse(0, err)))
}

// MustMarshallJSON either marshalls to json or panics
func MustMarshallJSON(o interface{}) []byte {
	bz, err := json.Marshal(o)
	if err != nil {
		panic(err)
	}
	return bz
}

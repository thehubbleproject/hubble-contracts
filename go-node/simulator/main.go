package simulator

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/BOPR/common"
	"github.com/BOPR/core"
	"github.com/BOPR/rest"
	"github.com/ethereum/go-ethereum/crypto"
)

const (
	SimulatorService = "simulator"
)

type Simulator struct {
	// Base service
	core.BaseService

	// DB instance
	DB core.DB

	// header listener subscription
	cancelSimulator context.CancelFunc

	toSwap bool
}

// NewSimulator returns new simulator object
func NewSimulator() *Simulator {
	logger := common.Logger.With("module", SimulatorService)
	sim := &Simulator{}
	sim.BaseService = *core.NewBaseService(logger, SimulatorService, sim)
	db, err := core.NewDB()
	if err != nil {
		panic(err)
	}
	sim.DB = db
	return sim
}

// OnStart starts new block subscription
func (s *Simulator) OnStart() error {
	s.BaseService.OnStart() // Always call the overridden method.

	ctx, cancelSimulator := context.WithCancel(context.Background())
	s.cancelSimulator = cancelSimulator

	go s.SimulationStart(ctx, 10*time.Second)

	s.toSwap = false
	return nil
}

// OnStop stops all necessary go routines
func (s *Simulator) OnStop() {
	s.BaseService.OnStop() // Always call the overridden method.

	s.cancelSimulator()
}

// SimulationStart starts the simulator
func (s *Simulator) SimulationStart(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	// stop ticker when everything done
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.sendTxsToAndFro()
			// pick batch from DB
		case <-ctx.Done():
			ticker.Stop()
			return
		}
	}
}

// tries sending transactins to and fro accounts to the rollup node
func (s *Simulator) sendTxsToAndFro() {
	AlicePrivKey := "9b28f36fbd67381120752d6172ecdcf10e06ab2d9a1367aac00cdcd6ac7855d3"
	BobPrivKey := "c8deb0bea5c41afe8e37b4d1bd84e31adff11b09c8c96ff4b605003cce067cd9"
	From := AlicePrivKey
	To := BobPrivKey
	FromID := uint64(2)
	ToID := uint64(3)
	if s.toSwap {
		tempID := FromID
		FromID = ToID
		ToID = tempID
		tempPrivKey := From
		From = To
		To = tempPrivKey
		s.toSwap = !s.toSwap
	}
	for i := 0; i < 2; i++ {
		privKeyBytes, err := hex.DecodeString(From)
		if err != nil {
			s.Logger.Error("unable to decode string", "error", err)
			return
		}
		key := crypto.ToECDSAUnsafe(privKeyBytes)

		latestFromAcc, err := s.DB.GetAccountByID(FromID)
		if err != nil {
			s.Logger.Error("unable to fetch latest account", "error", err)
			return
		}

		var txCore = core.Tx{
			From:    FromID,
			To:      ToID,
			Amount:  1,
			TokenID: latestFromAcc.TokenType,
			Nonce:   latestFromAcc.Nonce + 1,
		}

		signBytes, err := txCore.GetSignBytes()
		if err != nil {
			return
		}

		signature, err := crypto.Sign(signBytes, key)

		var tx = rest.TxReceiver{
			From:      txCore.From,
			To:        txCore.To,
			Amount:    1,
			TokenID:   txCore.TokenID,
			Nonce:     txCore.Nonce,
			Signature: hex.EncodeToString(signature),
		}

		payload, err := json.Marshal(tx)
		if err != nil {
			return
		}

		request, err := http.NewRequest("POST", "http://localhost:3000/tx", bytes.NewBuffer(payload))
		if err != nil {
			return
		}

		client := &http.Client{}
		resp, err := client.Do(request)
		if err != nil {
			panic(err)
		}

		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			s.Logger.Info("Tx sent!", "TxData", txCore.String())
		}
		if txCore.From == uint64(2) {
			s.toSwap = true
		}
	}

}

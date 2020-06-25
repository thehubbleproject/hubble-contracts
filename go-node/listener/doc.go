package listener

/**
Listener listens for events on various smart contracts and updates the DB state of the operator_address

Use Cases :
1. Syncing a new operator node
2. Syncing deposits
3. Confirming batches

Keeps track of following events:
1. Adds pending deposits
2. Adds incoming batches
3. Adds incoming accounts
4. Token Registrations
**/

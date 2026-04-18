# Test The Bouncer

This is the fastest way to get a real hook test working.

## What This Hook Currently Does

The current `bouncer.c` is a smoke-test hook.

It only checks `Payment` transactions:

- if `Destination == hook account`, it accepts
- if `Destination != hook account`, it rolls back

This is not final MPT enforcement yet. It is a first proof that the hook can block an unauthorized destination.

## Why This Is Still Useful

It proves three important things quickly:

1. your hook compiles
2. your hook deploys
3. your hook can actually reject a transaction on-ledger

That is the right first milestone.

## How To Deploy

1. Open XRPL Hooks Builder.
2. Paste in [bouncer.c](/C:/Users/natha/Downloads/block-sale/contracts/src/bouncer.c:1).
3. Compile it.
4. Deploy it to the issuer / vendor account from [devnet.json](/C:/Users/natha/Downloads/block-sale/contracts/devnet.json:1):
   `rDa3E72iujUJciri1B8djcmowVsuNDu4QT`

## How To Test

Use these accounts from `contracts/devnet.json`:

- issuer / vendor:
  `rDa3E72iujUJciri1B8djcmowVsuNDu4QT`
- holder:
  `rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS`
- unauthorized recipient:
  `rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z`

### Allowed test

Send a native-currency `Payment` from the holder to the issuer account.

Use:

```json
{
  "TransactionType": "Payment",
  "Account": "rH1wbyfhqKKvybioodsh9ctZiRf8rS1hKS",
  "Destination": "rDa3E72iujUJciri1B8djcmowVsuNDu4QT",
  "Amount": "1000000",
  "Fee": "12",
  "Flags": 2147483648,
  "Memos": []
}
```

Expected result:

- hook runs
- destination equals hook account
- transaction succeeds

### Blocked test

Send a native-currency `Payment` from the issuer account to the unauthorized recipient.

Use:

```json
{
  "TransactionType": "Payment",
  "Account": "rDa3E72iujUJciri1B8djcmowVsuNDu4QT",
  "Destination": "rp8CGFHmV53xKUuUQYfQFh26LBkYN1za8Z",
  "Amount": "1000000",
  "Fee": "12",
  "Flags": 2147483648,
  "Memos": []
}
```

Expected result:

- hook runs on the issuer account
- destination is not the hook account
- transaction rolls back

## Why Your Earlier Test Failed

This payload will not work for the current smoke test:

```json
{
  "Amount": {
    "value": "1",
    "currency": "MPT",
    "issuer": "rDa3E72iujUJciri1B8djcmowVsuNDu4QT"
  }
}
```

That shape is an IOU-style `Payment` amount, not a valid proof that real MPT transfer logic is working.

Your log confirms the ledger failed during payment pathfinding:

- `No credit line`
- `result: -94`

So the transaction failed before it became a good test of the hook's anti-destination rule.

For the current milestone, use native currency only. Once this hook behavior is proven, move to the real MPT transaction path next.

## Important Limitation

This test is about hook enforcement mechanics, not yet about the exact MPT transaction type.

The next iteration should replace this `Payment`-only smoke test with the real transaction type that carries the asset movement you want to forbid.

## Next Step After This Works

Once this smoke test passes, the next contract task should be:

- identify the exact transaction type and fields used for your real MPT movement
- update `bouncer.c` to inspect that transaction path instead of plain `Payment`

# UCoin purchases and 1145 Pay

Apply migrations through `20261022100000_universal_ucoin_and_pay.sql` (including
`20261022090000_pay_with_card_and_ucoin.sql`), deploy the updated
`payfast-payment` edge function, then publish the frontend. Coordinate the
migration and edge deployment during a payment maintenance window: older edge
instances do not reserve the new payment route. No live deployment is performed
by this change.

All signed-in account types can spend available UCoin. Standard shop checkout
supports partial or full UCoin; food, auction wins, service orders and merchant
QR requests support full UCoin payment. The rate remains R0.10 per UCoin; the
last fractional coin rounds up and the Rand credit is capped at the bill.
Merchants receive payment confirmation through the existing order/payment flows.

Existing pending food/service/auction purchases retain PayFast because they may
already have a live checkout link. New purchases can choose UCoin or PayFast;
once a PayFast checkout has opened, complete it on that route. Merchant QR
requests keep their existing owner/staff self-payment restriction.

Wallet and Services link to `/scan-pay`. Browsers with BarcodeDetector can scan
in the page; other phones can use the camera app or paste the merchant link.
Merchant QR links use the public URL inside the native app. This is QR payment,
not NFC terminal payment.

## Staging verification before release

Use funded test accounts and PayFast sandbox, never a real card charge.

- For each purchase type, pay with an ordinary account and verify one wallet
  debit, one spend transaction, and the correct paid order/merchant receipt.
- Test R0.01, R0.10, R0.11 and R12.35 bills: full coverage requires 1, 1, 2 and
  124 UCoin respectively, with no excess Rand credit.
- Reject an anonymous caller, another user's order, insufficient balance,
  cancelled/paid purchases, and a changed expected price without any debit.
- Submit the same purchase concurrently twice: only one call may debit.
- Pay two different purchases concurrently from a wallet that covers only one:
  only one may succeed, and the balance must stay nonnegative.
- Race PayFast initiation against UCoin payment: only one route may reserve the
  purchase. Retry the losing route and verify that it is rejected.
- Verify auction deposits count only when paid; order and order item creation
  must roll back together on failure. Verify service payment creates the normal
  service payment record and advances its workflow.
- Scan QR on Android and iOS, deny camera permission, paste a link, and reject
  external/invalid URLs. Sign in from the payment page and return to that request.
- Check existing and newly registered merchants can create QR requests; verify
  staff permissions, expiry, cancellation, insufficient UCoin and self-payment.

Database integration and live camera checks require a staging environment and
have not been run locally.

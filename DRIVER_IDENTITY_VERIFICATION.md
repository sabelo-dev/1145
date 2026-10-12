# Driver identity verification and profile-sharing investigations

This is the procedure for the 1145 staff who review drivers in the admin dashboard under **Driver Verification**. It covers the daily review queues and what to do when an account looks like it is being used by someone other than the registered driver.

A driver's identity is checked every time they work, not only when they register. The rule behind everything here: **only the person who registered may drive on an account, in a vehicle whose owner we know, with documents that are in date.**

## What the system does on its own

| Control | What happens |
| --- | --- |
| Selfie to go online | A driver cannot go online without taking a live selfie in the app. Each selfie comes with a pose to hold (for example "hold two fingers up next to your face"), so an old photo is easy to spot. |
| Random selfies | While a driver is online and has no passenger or parcel on board, the app asks for another selfie at a random time (45 to 180 minutes apart by default). They have 10 minutes. No selfie means they are taken offline. |
| One device | An account is bound to the phone it first goes online from. One switch to a new phone is allowed and raises an alert. A second switch within 30 days, or a phone already bound to another driver, is blocked until staff decide. |
| One session | An account can be online on one device at a time, and a vehicle can be online with one driver at a time. Every trip records the session it was done in: which driver, device, vehicle and selfie. |
| Document expiry | Each night, a driver whose PrDP, operating licence, roadworthy certificate or insurance has expired is suspended and told which document to renew. Drivers get a warning 14 days before. Approving the renewal reinstates them automatically. |

Selfies are **not** matched automatically. A person compares them. A driver stays online while their selfie waits for review, so the selfie queue is the one that must not build up.

## Daily queues

Work through these in the **Driver Verification** tab, oldest first.

1. **Selfie checks.** Compare the selfie with the registration photo. Check that the driver is holding the pose that was asked for.
   - *Same person*: nothing else happens.
   - *Does not match*: write why. The account is frozen immediately and an investigation is opened for you (see below). Use this when you believe it is a different person, not when the photo is merely dark or blurred. For a poor photo, pass it only if you can still recognise the driver; otherwise open an investigation without freezing and ask the driver for a clear one.
2. **Documents.** Open the file, check the type and the name, and correct the expiry date if the driver typed it wrongly. The expiry date you approve is the date the driver will be suspended after.
3. **Vehicles.** Check the owner's name and ID or company number against the vehicle's registration papers. If the driver is not the owner, read the owner's signed permission. A warning appears when the vehicle is already on record under a different owner: find out which is right before verifying.
4. **Alerts.** Each alert is a sign an account may be shared. Either dismiss it with a note saying what you checked, or investigate it.

## Gauteng operating licences (GPTRIS)

Drivers who operate in Gauteng record their operating licence through their GPTRIS application, under **Driver Verification → Gauteng licences**. Each driver is in one state:

| State | Meaning | May they operate? |
| --- | --- | --- |
| Verified | A licence has been issued, you have read it, and it is in date | Yes |
| Application pending | They have applied; all we hold is a receipt | No, unless a transitional period is running and you have confirmed the receipt |
| Expired | A licence was issued and has run out | No. They are suspended the day after expiry |
| Rejected | The regulator refused or withdrew it, or the record was not genuine | No |
| No application | Nothing recorded | No |

**A receipt is not a licence.** The system will not let you record a licence from a receipt: the driver has to upload the licence itself.

1. **Confirm the receipt.** Open the receipt, look the reference number up on GPTRIS, and check the name and vehicle match the driver. Confirming it does not let the driver operate; it records that the application is real.
2. **Record the licence.** When the driver uploads the issued licence, open it and copy the licence number, the expiry date and the approved operating area from the licence. If the details are wrong, send them back with the reason.
3. **Reject** when the regulator refused the application or the reference is not genuine. Use **Licence withdrawn** if a licence already on record is cancelled.

A driver with an expired licence stays expired while a renewal application is pending. A renewal receipt does not bring the old licence back.

### Transitional period

If a transitional rule allows operators with a pending application to keep operating, someone with authority to decide that sets a **last day** and writes down **the rule relied on** at the bottom of the Gauteng licences tab. Until that day, a driver whose receipt you have confirmed can go online without an issued licence. It ends by itself on the date and can be ended sooner. It is off unless someone sets it, and it never applies to a receipt nobody has checked, an expired licence or a rejected application.

The operating-licence requirement only stops drivers going online once **Require documents and a verified vehicle to go online** is switched on under Settings. An expired licence suspends the driver either way.

## Alerts and what they usually mean

| Alert | Usual explanation | When to investigate |
| --- | --- | --- |
| Went online from a new device | New or replaced phone | The same driver has other alerts, or the timing matches a complaint |
| Changed devices again within 30 days | Two phones in use on one account | Almost always: ask the driver why before approving the device |
| Tried a device bound to another driver | Two drivers sharing one phone | Always, for both drivers |
| Tried to go online on a second device | Someone else logged in while the driver was working | Always |
| Vehicle already online with another driver | Two accounts claiming the same car at once | Always |
| Did not answer a selfie request | Driver was busy, or the driver is not the account holder | Three or more in 30 days (shown as high) |
| Selfie did not match | Staff failed a selfie | Opened automatically |

## Investigating suspected profile sharing

### 1. Open the investigation

Open one from the alert (**Investigate**), from a failed selfie (automatic), or with **New investigation** for a report that reached you another way, such as a rider saying the driver was not the person shown in the app. Write what is being investigated in plain words. There is one open investigation per driver; anything new is added to it.

### 2. Decide whether to freeze

Freezing takes the driver offline at once and stops them going online or cashing out until the investigation is closed. Nobody, including an admin, can reactivate a frozen driver from the Driver Management screen: the only way out is to close the investigation.

- **Freeze now** when there is direct evidence someone else is driving: a failed selfie, a rider report that names a different person, a shared device, or a second device going online mid-shift.
- **Do not freeze yet** when the evidence is a single weak signal, such as one new device. Investigate first.

The driver is notified that their account is on hold and that they can contact support. They are not told what triggered it.

### 3. Gather the evidence

Add a note to the investigation for each thing you check, as you check it. The investigation shows the driver's devices, their recent sessions and their recent selfie checks. Look at:

- the driver's recent selfies beside the registration photo;
- their devices and when each was first used;
- when their sessions started and how they ended (a session ended for a missed selfie is worth a question);
- their recent trips, rider reports and ratings from the period, under Ride Monitoring;
- whether another driver account shares the device, the vehicle or the vehicle owner.

Then contact the driver, ask for their account of it, and record what they said. Where identity is still in doubt, ask them to verify in person or on a video call with their ID document.

### 4. Decide and close

Closing needs a written reason. It goes on the timeline and cannot be edited afterwards.

- **Clear and reinstate.** The freeze is lifted and the driver is told the review is finished. If one of their documents expired while they were frozen, they stay suspended for that reason until they renew it.
- **Confirm and close account.** The account stays suspended and the driver is told the account is closed and that they may appeal.

### 5. Appeals

A driver whose account was closed may appeal through support. Have someone other than the original reviewer open a new investigation on the driver, record the appeal and the new evidence in it, and close it. Clearing that investigation reinstates the driver.

## Records

The investigation's timeline is the record: who opened it and why, when the account was frozen, every note, the alerts attached to it, and the decision with its reason. Do not keep the reasoning for a decision anywhere else.

## Still to be decided

These are policy choices the tooling does not make. Until they are set, use your judgement and write down what you did.

- How quickly a selfie must be reviewed, and how quickly an investigation with a frozen account must be decided. A frozen driver is not earning, so this should be short.
- How long selfies and investigation records are kept, and how a driver can ask to see theirs. Selfies are personal information under POPIA.
- When to turn on **Require documents and a verified vehicle to go online** (under Settings). It is off so that existing drivers have time to upload. Once on, a driver without all four approved documents and a verified vehicle cannot go online.

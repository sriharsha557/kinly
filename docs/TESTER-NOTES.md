# Tester notes

Things testers need to know that the app itself cannot tell them. Newest
first. Each entry is written for someone who is not reading the code, so it
says what to do and what to expect, not how it works internally.

Delete an entry once every tester has a build past the one it applies to.

## After updating to the build dated 2026-08-07 or later

**If you have seen the "Something went wrong" screen on the Circle tab, tap
"Go home" once after updating — or just restart the app.**

The crash was caused by data the app had saved to your device in an older
format. The fix clears that saved data automatically, but the clear happens on
the next app launch, so the very first screen you see after updating may still
crash. "Go home" clears it immediately; restarting the app does the same
thing.

You only ever need to do this once. If the Circle tab crashes *again* after
that, it is a new bug and worth reporting.

One expected side effect the first time you open the app after updating: every
screen fetches its data fresh, so you may see brief loading spinners in places
that normally appear instantly. That is the cache being rebuilt, not a
regression.

## Known: Ask Friends replies do not appear immediately

Under investigation. After sending a reply, it may not show up — and the reply
count may not increase — until you pull to refresh, or leave the screen and
come back.

The reply *is* saved. Nothing is lost, and you do not need to send it again.
Sending it twice will post it twice.

Failed sends now tell you so, and keep your text so you can retry.

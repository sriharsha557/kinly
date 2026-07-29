# Data Safety Form — Answers for Kinly

Play Console → Policy → App content → Data safety.
Google's definition of "shared" excludes service providers processing on your behalf (Supabase, Sentry, Expo, Anthropic) — so almost everything below is **Collected: Yes, Shared: No**.

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (Supabase/Sentry/Expo are all HTTPS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app (Profile → Delete account) and via https://sriharsha557.github.io/kinly/delete-account.html |

## Data types to declare

### Personal info
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Name | Yes | No | No | App functionality, Account management |
| Email address | Yes | No | No | App functionality, Account management |
| Other info (bio, selected interests) | Yes | No | Yes | App functionality |

### Photos and videos
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Photos | Yes | No | Yes | App functionality (avatar, Vision Board, check-in photos) |

### Health and fitness
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Fitness info (step count via Health Connect) | Yes | No | Yes | App functionality |

> Declaring this triggers the separate **Health apps declaration** (App content → Health apps). Declare Health Connect use, purpose "fitness and wellness / step tracking for user-set goals", and confirm compliance with the Health Connect permissions policy. The privacy policy must explicitly cover step data — see the "Step goals & Health Connect" section added to privacy.html.

### Messages
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Other in-app messages (Ask Friends posts/replies, nudges, Future Letters) | Yes | No | Yes | App functionality |

### App activity
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| App interactions (goals, check-ins, streaks, mood check-ins) | Yes | No | No | App functionality |
| Other user-generated content | Yes | No | Yes | App functionality |

### App info and performance
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Crash logs | Yes | No | Yes | Analytics (Google's bucket for diagnostics) |
| Diagnostics | Yes | No | Yes | Analytics |

> These are Sentry. "Optional" because crashes only send when they occur; if you'd rather be conservative, mark "required".

### Device or other IDs
| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Device or other IDs | Yes | No | No | App functionality (push token), Analytics (Sentry installation ID) |

## Explicitly NOT collected (leave unchecked)

Location (precise or approximate) · Financial info · Contacts · SMS/call logs · Audio · Files and docs (images declared under Photos) · Calendar · Web browsing history · Search history · Installed apps · Advertising ID

## Data handling attestations per type

For every type above: **ephemeral processing = No**; users **can request deletion** = Yes.

## Common rejection traps

- The Data safety form must match what reviewers detect. Sentry is a known SDK — if you omit Crash logs/Diagnostics/Device IDs, expect a rejection.
- Health & fitness declared here **without** completing the Health apps declaration form = automatic rejection of the release.
- The account-deletion URL must be publicly reachable (no login wall) at submission time — publish delete-account.html to GitHub Pages before submitting.

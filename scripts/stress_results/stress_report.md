# Stress test report — run 5fcffe
Backend: https://backend-production-a20b.up.railway.app  |  started 2026-07-22T04:43:56Z  |  aborted: None

Billing: baseline spent $0.0 → final reported $0.0 (measured task cost $0.6640; reported spend self-reverts when test agents are deleted)

## Tasks
| label | tier | outcome | wall s | tokens | cost $ | keywords hit |
|---|---|---|---|---|---|---|
| adv-bad-model-run | probe | error_status_no_row | 42.1 | - | - | - |
| adv-free-tasktype | probe | finished | 10.6 | 1182 | 0.002837 | - |
| adv-sse-run | probe | finished | 8.1 | 1191 | 0.002858 | - |
| p1-easy-lease-summary | easy | finished | 21.0 | 1899 | 0.017091 | 3/3 |
| p1-medium-market-plan | medium | finished | 10.5 | 1668 | 0.015012 | 0/1 |
| p1-hard-browse-delegate | hard | finished | 15.8 | 1433 | 0.003439 | 0/1 |
| p2-easy-product-desc | easy | finished | 5.3 | 1409 | 0.003382 | 0/2 |
| p2-medium-csv-analysis | medium | finished | 15.8 | 2659 | 0.023931 | 0/1 |
| p2-hard-plan-delegate | hard | finished | 15.8 | 1753 | 0.015777 | - |
| p3-easy-notes-summary | easy | finished | 31.5 | 3015 | 0.027135 | 4/4 |
| p3-medium-browse-research | medium | finished | 10.6 | 1339 | 0.012051 | - |
| p3-hard-python | hard | finished | 10.6 | 1499 | 0.013491 | 0/1 |
| p4-easy-outreach | easy | finished | 52.4 | 3630 | 0.008712 | 1/1 |
| p4-easy2-brief | easy | finished | 52.4 | 4006 | 0.036054 | - |
| p4-medium-strategy | medium | finished | 73.5 | 4997 | 0.224865 | - |
| p4-hard-pipeline | hard | finished | 15.9 | 1543 | 0.069435 | - |
| p5-easy-clause | easy | finished | 26.2 | 2357 | 0.021213 | 2/2 |
| p5-medium-escalation | medium | finished | 10.6 | 1406 | 0.003374 | - |
| p5-hard-long-input | hard | finished | 47.2 | 16483 | 0.148347 | 3/5 |
| burst-0 | burst | finished | 28.1 | - | - | - |
| burst-3 | burst | finished | 28.3 | - | - | - |
| burst-4 | burst | finished | 28.4 | - | - | - |
| burst-2 | burst | finished | 28.0 | - | - | - |
| burst-1 | burst | finished | 27.9 | - | - | - |

## Probes
| id | area | pass | severity | actual |
|---|---|---|---|---|
| pre-health | reliability | PASS |  | 200 |
| pre-frontend | reliability | PASS |  | 200 |
| adv-signup | auth | PASS |  | 201 |
| adv-dup-name | validation | PASS |  | 409 |
| adv-bad-model | validation | PASS | P1 | error_status_no_row |
| adv-free-tasktype | validation | PASS | P2 | finished |
| adv-big-fields | validation | PASS | P2 | status=201 |
| cleanup-ZZ-STRESS-ADV-Big-5fcffe-xxxxxxxxxxxxxxx | cleanup | PASS |  | 204, gone=True |
| adv-empty-name | validation | FAIL | P2 | 201 |
| cleanup-(empty) | cleanup | PASS |  | 204, gone=True |
| adv-404 | validation | PASS |  | 404 |
| adv-bad-uuid | validation | PASS |  | 422 |
| adv-sse | streaming | FAIL | P1 | CONNECTED,STATE_SNAPSHOT,TEXT_MESSAGE_START,TEXT_MESSAGE_CONTENT,TEXT_MESSAGE_EN |
| cleanup-ZZ-STRESS-ADV-Dup-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-ADV-BadModel-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-ADV-Type-5fcffe | cleanup | PASS |  | 204, gone=True |
| p1-a2a-child | a2a | FAIL | P1 | none |
| p1-a2a-comm | a2a | FAIL | P2 | 200 |
| p1-memories | memory | PASS |  | 1 |
| cleanup-ZZ-STRESS-P1-Analyst-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-P1-Coordinator-5fcffe | cleanup | PASS |  | 204, gone=True |
| p2-a2a-child | a2a | FAIL | P1 | none |
| p2-memories | memory | FAIL | P2 | 0 |
| cleanup-ZZ-STRESS-P2-Copywriter-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-P2-Growth-5fcffe | cleanup | PASS |  | 204, gone=True |
| p3-memories | memory | PASS |  | 1 |
| cleanup-ZZ-STRESS-P3-DataAnalyst-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-P3-Researcher-5fcffe | cleanup | PASS |  | 204, gone=True |
| p4-a2a-child | a2a | FAIL | P1 | none |
| p4-network-edge | a2a | PASS |  | 200 |
| p4-memories | memory | PASS |  | 2 |
| cleanup-ZZ-STRESS-P4-Strategist-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-P4-Copywriter-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-P4-BriefWriter-5fcffe | cleanup | PASS |  | 204, gone=True |
| p5-notify-human | hitl | FAIL | P1 | 0 |
| p5-memories | memory | PASS |  | 2 |
| cleanup-ZZ-STRESS-P5-Contracts-5fcffe | cleanup | PASS |  | 204, gone=True |
| cleanup-ZZ-STRESS-P5-Paralegal-5fcffe | cleanup | PASS |  | 204, gone=True |
| burst-complete | reliability | PASS |  | 5 |
| burst-count-race | reliability | PASS |  | 5 |
| cleanup-ZZ-STRESS-Burst-5fcffe | cleanup | PASS |  | 204, gone=True |
| sweep/stats/overview | reliability | PASS |  | 200 |
| sweep/stats/agents | reliability | PASS |  | 200 |
| sweep/stats/activity?limit=30 | reliability | PASS |  | 200 |
| sweep/stats/timeseries?days=14 | reliability | PASS |  | 200 |
| sweep/stats/network | reliability | PASS |  | 200 |
| sweep/.well-known/agent-card.json | reliability | PASS |  | 200 |
| final-clean | cleanup | PASS |  | [] |
| final-workspace-restored | cleanup | PASS |  | added=set() removed=set() |

HTTP calls: 608, p50 113ms, p95 154ms

## Notes
- signup created a permanent org row (no org delete endpoint) — residue invisible to the default workspace

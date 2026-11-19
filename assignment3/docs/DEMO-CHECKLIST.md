# Assignment 3 demonstration checklist

Use the application after `docker compose up --build` completes. Capture real screenshots from the browser while following these steps and save them under `docs/screenshots/` before submitting.

1. Show the Operations Dashboard with clients, accounts, seeded transfers, risk counts, and approval outcomes.
2. Open each seeded transfer: `LOW-DEMO`, `MEDIUM-DEMO`, `HIGH-DEMO`, and `CRITICAL-DEMO`; capture its risk score, rules, and approval status.
3. Attempt to process `MEDIUM-DEMO` while it is awaiting approval. Show the blocked response and unchanged transaction status.
4. Approve the Medium workflow as Olivia Chen, then process the transfer and show its completed status.
5. Approve the first High stage as Olivia Chen and show that the Senior Reviewer stage becomes active. Approve it as Daniel Brooks.
6. Complete Critical approval as Daniel Brooks followed by Priya Shah.
7. Reject one separate workflow and show that processing remains blocked.
8. Escalate an active workflow and show the escalation reason, destination role, and continued processing block.
9. Show the risk policy directory and a policy detail page with its version, thresholds, and rules.
10. Restart the Compose services without deleting the volume and show that transaction and decision records remain present.

Never present sample data as live bank data. The four clients, accounts, transactions, and reviewer identities are fictional demonstration records.

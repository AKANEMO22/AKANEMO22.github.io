# FA24-RE OCR and answer QA

## Verification performed

- Confirmed 50 full-resolution source images (`1920 × 780`) and 50 corresponding manifest rows.
- Compared the original-image and thresholded-image OCR passes for all 50 questions.
- Manually inspected the source images for questions whose OCR lost code, formulas, options, or punctuation, including Q23, Q24, Q29, Q35, Q36, Q42, and Q50.
- Independently checked the answer key and explanations against the question content.
- JSON answers use zero-based option indexes.

## Answer key

`1B, 2B, 3B, 4A, 5A, 6B, 7C, 8A, 9D, 10B, 11C, 12B, 13A, 14A, 15A, 16A, 17B, 18A, 19A, 20A, 21A, 22C, 23A, 24A, 25B, 26B, 27B, 28A, 29A*, 30A, 31D, 32A, 33C, 34B, 35C, 36A, 37A, 38B, 39D*, 40A, 41A, 42B*, 43A, 44A, 45A, 46A, 47D, 48C*, 49A, 50A`

An asterisk marks a source-defective question whose stored answer is the closest or likely intended option, not a fully correct option.

## Source ambiguities and defects

- **Q12 — B, medium confidence:** Distributed consistency admits several valid designs. Eventual consistency with conflict resolution is the most realistic general answer among the supplied choices.
- **Q25 — B:** A complete HTTP response has a status/start line, headers, and an optional body. Option A wrongly substitutes the header/body separator for the status line.
- **Q29 — A as intended proxy:** `arr[:, 1:]` keeps all rows and removes only the first column. None of the choices states that. A additionally and incorrectly claims the first row is removed.
- **Q30 — A, medium confidence:** The answer depends on the referenced lab. In that lab, Matplotlib is used to plot the chart.
- **Q38 — B, medium confidence:** Visualization is the broadest initial exploration step among the choices, although calculating summary statistics is also a normal early EDA action.
- **Q39 — D as closest option:** Since `p = 0.10 > α = 0.05`, the correct decision is to fail to reject the null. D has the correct inconclusive conclusion but reverses the reason: the p-value is too large, not too small.
- **Q42 — B as intended proxy:** The general addition rule is `P(A ∪ B) = P(A) + P(B) - P(A ∩ B)`. B is valid only if A and B are mutually exclusive, an assumption omitted from the prompt.
- **Q47 — D, medium confidence:** Docker, Kubernetes, and Ansible are better described as DevOps, deployment, orchestration, or infrastructure-automation tools. Workflow Management is only the closest supplied category.
- **Q48 — C as intended proxy:** `arr[:2, ::2]` has shape `(2, 3)`, which is absent from the choices. C is retained as the likely intended key.

All 50 records are marked `verified: true` because the OCR transcription and source-image mapping were verified. The notes above distinguish verification of the transcription from defects in the source questions.

# FA24-RE independent answer audit

This audit was produced independently from `data/ocr-raw/FA24-RE.json` and the original images. It does not read, use, or modify `data/exams/FA24-RE.json`.

## Independent answer key

`1B, 2B, 3B, 4A, 5A, 6B, 7C, 8A, 9D, 10B, 11C, 12B, 13A, 14A, 15A, 16A, 17B, 18A, 19A, 20A, 21A, 22C, 23A, 24A, 25B, 26B, 27B, 28A, 29A*, 30A, 31D, 32A, 33C, 34B, 35C, 36A, 37A, 38B, 39D*, 40A, 41A, 42B*, 43A, 44A, 45A, 46A, 47D, 48C*, 49A, 50A`

An asterisk marks a source-defective question for which the letter is only the closest/intended proxy, not a fully correct option.

## Confidence by question

| Q | Answer | Confidence | Q | Answer | Confidence |
|---:|:---:|:---:|---:|:---:|:---:|
| 1 | B | High | 26 | B | High |
| 2 | B | High | 27 | B | High |
| 3 | B | High | 28 | A | High |
| 4 | A | High | 29 | A* | Low |
| 5 | A | High | 30 | A | Medium |
| 6 | B | High | 31 | D | High |
| 7 | C | High | 32 | A | High |
| 8 | A | High | 33 | C | High |
| 9 | D | High | 34 | B | High |
| 10 | B | High | 35 | C | High |
| 11 | C | High | 36 | A | High |
| 12 | B | Medium | 37 | A | High |
| 13 | A | High | 38 | B | Medium |
| 14 | A | High | 39 | D* | High conclusion / Low wording |
| 15 | A | High | 40 | A | High |
| 16 | A | High | 41 | A | High |
| 17 | B | High | 42 | B* | Low |
| 18 | A | High | 43 | A | High |
| 19 | A | High | 44 | A | High |
| 20 | A | High | 45 | A | High |
| 21 | A | High | 46 | A | High |
| 22 | C | High | 47 | D | Medium |
| 23 | A | High | 48 | C* | Low |
| 24 | A | High | 49 | A | High |
| 25 | B | High | 50 | A | High |

## Ambiguous or source-defective questions

### Q12 — B, medium confidence

Distributed consistency can be approached in several ways. B, accepting eventual consistency and resolving conflicts, is the most realistic general solution among the choices. A describes a strong-consistency goal, while C is a costly specific mechanism rather than a universal solution.

### Q25 — B, high confidence

An HTTP response message consists of a status/start line, headers, and a body, so B is technically correct. Some course materials simplify this as “headers, blank line, and body” (A), but that omits the status line and treats the separator as a message component.

### Q29 — A as intended proxy, low confidence

The image clearly shows:

```python
sliced_arr = arr[:, 1:]
```

This keeps every row and removes the first column. None of the choices says that. A says it removes both the first row and first column, so A is only the closest likely intended option. There is no fully correct answer in the source.

### Q30 — A, medium confidence

The question is lab-specific: “The Python library we used to plot the chart in the lab is”. In the associated IBM APIs/data-collection lab, the plotting library is Matplotlib. Without the lab context, Plotly would also be a plausible charting library.

### Q38 — B, medium confidence

For a newly presented dataset, visualizing it is the broadest initial exploration step among the options. Calculating summary statistics is also a standard early EDA action, while cleaning missing values belongs to preparation after the data's condition has been inspected.

### Q39 — D as closest option

At `p = 0.10` and `α = 0.05`, the decision is to fail to reject the null hypothesis; the result is inconclusive. D has the correct conclusion but reverses the reason: the p-value is too **large**, not too small, to reject the null. A–C are unsupported.

### Q42 — B as intended proxy, low confidence

The general addition rule is:

```text
P(A ∪ B) = P(A) + P(B) - P(A ∩ B)
```

No option states this. B, `P(A) + P(B)`, is correct only when A and B are mutually exclusive, an assumption missing from the prompt. B is therefore the likely intended classroom option, not a universally correct answer.

### Q47 — D, medium confidence

Docker, Kubernetes, and Ansible are container/orchestration/infrastructure automation tools. Of the four coarse categories offered, Workflow Management is the closest fit. The taxonomy is weak because “DevOps”, “deployment”, or “execution environment” would be more precise.

### Q48 — C as intended proxy, low confidence

For a `(5,5)` array:

```python
arr[:2, ::2]
```

selects 2 rows and columns 0, 2, and 4, so the actual shape is `(2,3)`. That shape is absent. C `(2,2)` is retained only as the likely intended key; no listed answer is mathematically correct.

## Manual image checks

Direct image inspection was performed for Q23, Q24, Q29, Q30, Q42, Q47, Q48, and Q50. Both OCR passes were compared for all 50 questions.

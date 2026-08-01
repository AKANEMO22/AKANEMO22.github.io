# SU25-FE independent answer audit

This audit was produced independently from `data/ocr-raw/SU25-FE.json` and the original images. It does not use or modify `data/exams/SU25-FE.json`.

## Independent answer key

`1B, 2B, 3B, 4A, 5A, 6A, 7B, 8C, 9A, 10B, 11A, 12A, 13A, 14A, 15A, 16A, 17C, 18C, 19A, 20A, 21A, 22A, 23C, 24C, 25B, 26A, 27A, 28A, 29A, 30C, 31C, 32C, 33A, 34A, 35B, 36A, 37C, 38A, 39A, 40A, 41B, 42A, 43D, 44A, 45D, 46A, 47B, 48C, 49C, 50D`

## Question-by-question comparison

| Q | Independent | Post key | Result |
|---:|:---:|:---:|:---|
| 1 | B | B | Match |
| 2 | B | B | Match |
| 3 | B | B | Match |
| 4 | A | A | Match |
| 5 | A | A | Match |
| 6 | A | A | Match |
| 7 | B | B | Match |
| 8 | C | C | Match |
| 9 | A | A | Match |
| 10 | B | B | Match |
| 11 | A | A | Match |
| 12 | A | A | Match |
| 13 | A | A | Match |
| 14 | A | A | Match |
| 15 | A | A | Match |
| 16 | A | A | Match |
| 17 | C | C | Match |
| 18 | C | C | Match |
| 19 | A | A | Match |
| 20 | A | A | Match |
| 21 | A | A | Match |
| 22 | A | A | Match |
| 23 | C | C | Match |
| 24 | C | C | Match |
| 25 | B | B | Match |
| 26 | A | A | Match |
| 27 | A | A | Match |
| 28 | A | A | Match |
| 29 | A | A | Match |
| 30 | C | C | Match |
| 31 | **C** | **A** | **Different** |
| 32 | C | C | Match |
| 33 | A | A | Match |
| 34 | A | A | Match |
| 35 | B | B | Match |
| 36 | A | A | Match |
| 37 | C | C | Match |
| 38 | A | A | Match |
| 39 | A | A | Match |
| 40 | A | A | Match |
| 41 | B | B | Match |
| 42 | A | A | Match |
| 43 | **D** | **B** | **Different** |
| 44 | A | A | Match |
| 45 | D | D | Match |
| 46 | A | A | Match |
| 47 | B | B | Match |
| 48 | C | C | Match |
| 49 | **C** | **D** | **Different** |
| 50 | D | D | Match |

## Differences and rationale

### Q31 — independent C, post A

Question: data is missing at random; which imputation method is suitable?

- **C. K-Nearest Neighbors imputation** can use relationships with observed features to estimate a missing value, making it the strongest choice among the options for a MAR setting.
- **A. Mean imputation** may be a simple classroom answer, but unconditional mean replacement discards relationships with observed variables and underestimates variance. No distributional information is provided that would justify choosing the mean over the other simple summaries.
- Confidence: **medium** because the prompt is underspecified and several listed methods can technically be applied. If following the post/course key verbatim, use A; if prioritizing statistical methodology, use C.

### Q43 — independent D, post B

The two-sample t-test gives `p = 0.10` at `α = 0.05`.

- Since `0.10 > 0.05`, the correct decision is to **fail to reject the null hypothesis**. The data do not establish a difference or a direction between materials.
- **B. Material A will have higher strength than Material B** is unsupported by the p-value and the prompt gives no sample means.
- **D** is the closest available option because it says the test is inconclusive. Its reason is itself misstated: the p-value is too **large**, not too small, to reject the null.
- Confidence: **high** that B is wrong; the source has no completely correct option.

### Q49 — independent C, post D

Question: purpose of regularization in machine-learning models.

- **C. To prevent overfitting** is the primary purpose.
- Regularization commonly reduces model variance but introduces or increases bias. Therefore **A. To reduce bias** is false in the usual bias–variance interpretation.
- Because A is false, **D. All of the above** cannot be correct. B describes a common effect, while C most directly states the purpose.
- Confidence: **high**.

## Additional source ambiguities that do not change the comparison

- **Q9:** The source constructs `df_product` but every answer queries `df`. A is still the intended pair because it uses logical AND in both pandas and SQL; the variable-name inconsistency exists in the source.
- **Q39:** Homogeneity of variance and independence of observations are both ANOVA assumptions. A matches the post and is the intended ANOVA-specific answer, but C is also a genuine assumption.
- **Q43:** As noted above, no answer is fully correct because D contains the reversed phrase “p-value is too small.”

Manual image checks were performed for Q3, Q9, Q29, Q31, Q34, Q43, and Q49.

# SU25-FE OCR and answer QA

- Source: 50 full-resolution WebP images in `public/exams/SU25-FE/images`.
- OCR: compared `pass_original` with `pass_thresholded` for all 50 questions.
- Manual image checks: Q3, Q9, Q29, Q31, Q34, Q43, and Q49.
- Output uses zero-based answer indices (`0=A`, `1=B`, `2=C`, `3=D`, `4=E`).
- Final answer key was independently checked before writing the JSON.

## Exceptions to the post key

1. **Q31 — C instead of A.** K-Nearest Neighbors imputation can use relationships with observed features in a missing-at-random setting. Mean replacement ignores those relationships and underestimates variance. The question is underspecified, so confidence is medium.
2. **Q43 — D instead of B.** With `p=0.10 > α=0.05`, the result does not establish a difference or direction, so Material A cannot be declared stronger. D is the only inconclusive choice, although the source reverses “too large” into “too small.”
3. **Q49 — C instead of D.** Regularization primarily prevents overfitting and generally increases rather than reduces bias. Since A is false, “All of the above” cannot be correct.

## Other source notes

- **Q9:** The source creates `df_product` but every answer queries `df`. A is still the intended answer because it uses logical AND correctly in both pandas and SQL.
- **Q39:** Homogeneity of variance and independence of observations are both ANOVA assumptions. A is retained as the intended ANOVA-specific answer.
- **Q43:** No option is perfectly worded; the explanation records the statistically correct decision.

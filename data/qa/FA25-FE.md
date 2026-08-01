# FA25-FE OCR and answer QA

- Source: 50 full-resolution WebP images in `public/exams/FA25-FE/images`.
- OCR: compared `pass_original` with `pass_thresholded` for all 50 questions.
- Manual image checks: Q3, Q5, Q8, Q13, Q14, Q21, Q30, Q33, Q36, Q37, Q38, Q39, Q40, Q42, and Q43.
- Output uses zero-based answer indices (`0=A`, `1=B`, `2=C`, `3=D`).

## Remaining source ambiguities

1. **Q14** — All four libraries can connect to at least one kind of SQL database. The intended broad notebook/database abstraction is taken to be **B. SQLAlchemy**.
2. **Q21** — **A** (`arr[:3, -3:]`) and **D** (`arr[:3, 3:]`) both return the first three rows and last three columns for the stated fixed shape `(6, 6)`. A is selected because negative slicing expresses "last 3 columns" generally.
3. **Q37** — Both homogeneity of variance and independence of observations are ANOVA assumptions. **A. Homogeneity of variance** is selected as the intended ANOVA-specific choice.
4. **Q40** — At `p = 0.10` and `α = 0.05`, the correct decision is to fail to reject the null hypothesis. **D** is the only inconclusive choice, but the source incorrectly says the p-value is "too small"; it should say it is too large to reject the null.

All other questions and choices were readable after the two OCR passes and/or direct inspection, and their answers were independently checked from the underlying concepts.

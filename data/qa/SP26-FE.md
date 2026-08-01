# SP26-FE OCR and answer QA

- Source: 50 full-resolution JPG images in `public/exams/SP26-FE/images`.
- OCR: compared `pass_original` with `pass_thresholded` for all 50 questions.
- Manual image checks: Q1, Q15, Q20, Q22, Q23, Q25, Q31, Q34, Q39, Q40, and Q47.
- Output uses zero-based answer indices (`0=A`, `1=B`, `2=C`, `3=D`, `4=E`).
- The source genuinely contains three options for Q1 and five options for Q34; these were preserved.

## Remaining source ambiguities

1. **Q15** — Both Plotly and Bokeh create interactive Python visualizations. **A. Plotly** is selected as the intended course answer.
2. **Q31** — A, B, and D can all return the requested scalar for a suitably indexed DataFrame. **A** is selected because `df.loc[row, column]` is the canonical direct `loc` expression and avoids chained indexing.
3. **Q33** — Skipping Levene's test does not automatically invalidate a t-test: equal variances may already be justified, or a Welch t-test may be used. **A** is selected as the intended warning for a pooled-variance t-test when variances differ.
4. **Q40** — Quantile regression is useful both for heteroscedastic data and for modeling conditional quantiles. **D** is selected because it states the defining target, the conditional median.
5. **Q47** — Regularization reduces variance and prevents overfitting, but normally increases bias. Therefore **C** is selected rather than D (`All of the above`), since A is false.

All other questions and choices were readable after the two OCR passes and/or direct inspection, and their answers were independently checked from the underlying concepts.

# OCR coverage review

The four ADY201m exams are checked against all 200 original source images.

## Required checks

- Every structured question points to the same original image recorded by the OCR pass.
- Every image SHA-256 must still match the reviewed source.
- Question text is compared with two OCR passes after removing page chrome.
- Every answer choice A–E is compared independently.
- Tables, code, formulas, and scenario details remain part of the question transcript.

## Corrections from the full review

- `SP26-FE Q34`: restored the Z-score table heading, five columns, and all three data rows.
- `SU25-FE Q9`: restored the complete `product_data` DataFrame example and the final Pandas/SQL prompt.
- `SU25-FE Q33`: restored the before/after campaign context.
- `SU25-FE Q42`: restored sample size, mean reduction, and standard deviation.
- `SU25-FE Q43`: restored the full two-sample t-test scenario.
- `FA24-RE Q39 A`: restored the option wording exactly as printed in the source.

Four historical OCR crops (`FA24-RE Q24`, `FA24-RE Q29`, `SU25-FE Q3`, and
`SU25-FE Q34`) do not contain enough text for a reliable automated comparison.
Those source images were reviewed directly and stay protected by image hashes.

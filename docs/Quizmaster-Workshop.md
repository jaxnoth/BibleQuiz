# Quizmaster Workshop notes

Internal study notes distilled for BibleQuiz product planning. Not a substitute for your league's official rulebook. Confirm local rules with your quiz director.

## Distribution

This app is for **internal personal use**. Do not publish Scripture text publicly until translation permission and copyright notice are confirmed.

## Question types (workshop map)

| Workshop / sheet | Round count (20) | App code | Status in app |
|---|---:|---|---|
| General | 11 | `G` | In bank |
| According To | 4 | `A` | In bank |
| Quote | 1 | `Q` | In bank |
| Finish this verse (Verse) | 1 | `V` | Future bank |
| Finish + give reference | 1 | `R` | Future bank |
| B&C / Situation | 1 | `S` | Situation questions for John |
| Context | 1 | `X` | In bank (display: Context) |

Canonical progress and stats keys remain `A|G|Q|S|X`. Display labels come from `typeName` (or UI maps), not from the stats key.

**Workshop "Reference"** means finish this verse **and** give the reference. That maps to future code `R`. It is **not** RTF type `X` (Context). Future app **"Reference matching"** is a separate feature.

For John, B&C/Situation maps to Situation (`S`). True book-and-chapter questions are a future epistle-season concern.

## Reading and answering

- Quizmaster reads the question clearly; quizzers jump (buzz) when ready.
- After a jump, the quizzer completes the required answer for that type.
- Quote and finish-the-verse styles require accurate wording from the study translation.
- Context questions ask about surrounding verses or how a statement fits the passage.
- Situation questions ask who / to whom / when / where style facts from the text.

## Correctness

- Correct answers follow the official key wording and reference where required.
- Partial or interrupted answers may be ruled incomplete depending on league rules.
- Self-scoring practice in this app is a training aid, not an official ruling.

## Appeals and fouls

- Appeals go through the quizmaster / judges per league procedure.
- Common fouls include early jumps without completing the question requirement, interrupting improperly, or coaching during a locked answer.
- Practice modes here do not simulate live foul adjudication.

## Timing

- A standard practice round targets **20 questions**.
- Official round type mix uses the quota counts above (percentages on sheets are documentation only).
- Buzzer practice and speed rounds in the app are training tools and do not replace meet timing rules.

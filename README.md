# AI PM Job Radar

Every open product manager role at 36 AI and tech companies, sorted into four groups:

- **AI PM, no ML background required**
- **AI PM, ML background required**
- **PM, not AI**
- **Not actually a PM role** (product marketing, product design, product engineering, and so on)

A title regex can't do this. "Director, Product Marketing" has "product" in the title, and Datadog's "APM" is Application Performance Monitoring, not an associate PM. The sorting is done by [Jev](https://docs.typesafe.ai), TypeSafe's decision model, called through [Vercel AI Gateway](https://vercel.com/ai-gateway). Jev answers typed questions (choice, score, yes/no) with probabilities and can't write text, so it can't make up a label outside the list.

> **Status: in progress.** The data pipeline works. Eval numbers and the live site are coming, and nothing below claims accuracy that hasn't been measured yet.

## How it works

```
public job boards ──> fetch.py ──> input.jsonl ──> label.mjs ──> results.json ──> site
(Greenhouse, Ashby,   facts in code:               Jev via AI Gateway:
 Lever; no auth)      title filter, pay range,     role kind, AI scope, seniority,
                      remote flag                  ML required, eng background required
```

- **Code computes facts, Jev judges meaning.** Pay ranges, remote flags and the first title filter are regex. Whether a role is really a PM job and how central AI is to the product are Jev questions.
- **Every question and threshold lives in one file:** [`pipeline/spec.json`](pipeline/spec.json).
- **Answers are cached** by question set and posting, so the daily rerun only pays for new postings.

## Run it yourself

```bash
npm install
cp .env.example .env          # add an AI Gateway key
npm run fetch                 # about 8,000 roles scanned, product roles kept
npm run sample                # 40 random postings, under half a cent
npm run label                 # everything, about 8 cents
```

## Eval

Coming next: a hand-labeled golden set, with Jev compared against a title regex on accuracy, cost and latency.

## License

MIT

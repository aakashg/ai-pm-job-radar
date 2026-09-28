import spec from '../../pipeline/spec.json';
import { BUCKETS, data, fmtDate } from '../lib';

type Q = { type: string; instructions: string; criteria: Record<string, string> | string[] };

export const metadata = { title: 'Methods · AI PM Job Radar' };

export default function Methods() {
  const questions = spec.questions as unknown as Record<string, Q>;
  return (
    <article className="prose">
      <h1>Methods</h1>

      <h2>Pipeline</h2>
      <ol>
        <li><strong>Fetch.</strong> Every open role is pulled from {data.boards} public Greenhouse, Ashby and Lever boards. Roles with “product”, “PM” or “APM” in the title are kept. Pay ranges and remote flags are extracted with regular expressions, because code handles facts better than a model.</li>
        <li><strong>Label.</strong> Each posting’s title, department, location and description go to <a href="https://docs.typesafe.ai">Jev</a>, TypeSafe’s decision model, through Vercel AI Gateway. Jev answers the typed questions below with a probability for every option. It can’t write text, so it can’t return a label that isn’t on the list.</li>
        <li><strong>Sort.</strong> The answers are combined into groups by the rules below. The first matching rule wins, and anything Jev wasn’t confident about lands in “Needs review”.</li>
      </ol>

      <h2>Latest run</h2>
      <p>{data.headline ?? 'No labeled run has been published yet.'}{data.labeledAt ? ` Labeled ${fmtDate(data.labeledAt)}.` : ''}</p>

      <h2>Accuracy</h2>
      <p>Not measured yet. A hand-labeled golden set is next, and this section will report Jev against a title-only rule, with the numbers. Until then, treat every label as a first pass and check the original posting.</p>

      <h2>The questions, verbatim</h2>
      {Object.entries(questions).map(([key, q]) => (
        <section key={key} className="q">
          <h3><code>{key}</code> <span className="qtype">{q.type === 'noul' ? 'yes/no' : q.type}</span></h3>
          <p>{q.instructions}</p>
          <ul>
            {Array.isArray(q.criteria)
              ? q.criteria.map((c, i) => <li key={i}><code>{i}</code> {c}</li>)
              : Object.entries(q.criteria).map(([opt, c]) => <li key={opt}><code>{opt}</code> {c}</li>)}
          </ul>
        </section>
      ))}

      <h2>Groups</h2>
      <ul>
        {BUCKETS.map((b) => <li key={b.id}><strong>{b.label}.</strong> {b.hint}.</li>)}
      </ul>

      <h2>Limits</h2>
      <ul>
        <li>Only the {data.boards} boards listed in <a href="https://github.com/aakashg/ai-pm-job-radar/blob/main/pipeline/boards.json">boards.json</a> are covered, and a posting without “product” or “PM” in its title is never seen.</li>
        <li>Pay is shown only when the posting states it, and it isn’t estimated otherwise.</li>
        <li>Job descriptions are untrusted text. They are judged as content, never followed as instructions.</li>
      </ul>
    </article>
  );
}

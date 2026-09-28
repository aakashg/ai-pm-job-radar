import Radar from './radar';
import { data, fmtDate } from './lib';

export default function Page() {
  const labeled = data.rows.filter((r) => r.bucket).length;
  return (
    <>
      <section className="hero">
        <h1>Which open PM roles are actually AI PM roles?</h1>
        <p className="lede">
          {data.rows.length.toLocaleString()} roles with “product” in the title, from {data.boards} AI and tech company careers boards.
          A title can’t tell you which ones are real PM jobs, which work on an AI product, or which require an ML background.
          Every posting’s description is read and sorted by a model.
        </p>
        <p className="meta">
          Postings fetched {fmtDate(data.fetchedAt)}
          {data.labeledAt ? <> · labeled {fmtDate(data.labeledAt)} · {data.model}</> : null}
        </p>
        {labeled === 0 && (
          <p className="notice">
            Labels are still being generated. Every posting is listed below with its sort columns blank until the first labeled run is published.
          </p>
        )}
      </section>
      <Radar rows={data.rows} />
    </>
  );
}

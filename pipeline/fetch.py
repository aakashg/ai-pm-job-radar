#!/usr/bin/env python3
"""Pull every open role from public Greenhouse, Ashby and Lever job boards, keep the ones with
"product" or "PM" in the title, and write input.jsonl for jev.py. No key needed for this step.

  python3 fetch.py [--out input.jsonl] [--boards boards.json] [--all-titles]

boards.json maps an ATS to company slugs (the part after /boards/ or /job-board/ in the
careers URL). Edit it to point the radar at other companies.
"""
import argparse, html, json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
TITLE_RE = re.compile(r"\bproduct\b|\bPM\b|\bAPM\b", re.I)
MONEY_RE = re.compile(r"\$\s?(\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d)?\s?[kK])")
REMOTE_RE = re.compile(r"\bremote\b", re.I)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 ai-pm-job-radar"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)


def plain(s):
    s = html.unescape(s or "")
    s = re.sub(r"<(br|/p|/li|/h\d)[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"[ \t\xa0]+", " ", s)
    return re.sub(r"\n\s*\n+", "\n", s).strip()


def money(text):
    vals = []
    for m in MONEY_RE.findall(text):
        m = m.replace(",", "").replace(" ", "")
        v = float(m[:-1]) * 1000 if m[-1] in "kK" else float(m)
        if 40_000 <= v <= 2_000_000:
            vals.append(int(v))
    return (min(vals), max(vals)) if vals else (None, None)


def greenhouse(slug):
    d = get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true")
    for j in d.get("jobs", []):
        yield {"title": j["title"], "location": (j.get("location") or {}).get("name", ""),
               "department": ", ".join(x["name"] for x in j.get("departments", [])),
               "url": j.get("absolute_url"), "description": plain(j.get("content"))}


def ashby(slug):
    d = get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true")
    for j in d.get("jobs", []):
        comp = (j.get("compensation") or {}).get("compensationTierSummary") or ""
        yield {"title": j["title"], "location": j.get("location", "") + (" (remote)" if j.get("isRemote") else ""),
               "department": j.get("department") or j.get("team") or "", "url": j.get("jobUrl"),
               "description": (comp + "\n" if comp else "") + (j.get("descriptionPlain") or plain(j.get("descriptionHtml")))}


def lever(slug):
    for j in get(f"https://api.lever.co/v0/postings/{slug}?mode=json"):
        lists = "\n".join(f"{l.get('text','')}\n{plain(l.get('content',''))}" for l in j.get("lists", []))
        cats = j.get("categories") or {}
        yield {"title": j["text"], "location": cats.get("location", ""), "department": cats.get("team", ""),
               "url": j.get("hostedUrl"), "description": (j.get("descriptionPlain") or "") + "\n" + lists}


ATS = {"greenhouse": greenhouse, "ashby": ashby, "lever": lever}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="input.jsonl")
    ap.add_argument("--boards", default=str(HERE / "boards.json"))
    ap.add_argument("--all-titles", action="store_true", help="keep every role, not just product titles")
    a = ap.parse_args()
    boards = json.loads(Path(a.boards).read_text())
    jobs = [(ats, slug) for ats, slugs in boards.items() for slug in slugs]

    def pull(job):
        ats, slug = job
        try:
            return slug, list(ATS[ats](slug))
        except Exception as e:
            print(f"  skip {ats}/{slug}: {e}", file=sys.stderr)
            return slug, []

    total, kept = 0, []
    with ThreadPoolExecutor(12) as ex:
        for slug, roles in ex.map(pull, jobs):
            total += len(roles)
            for r in roles:
                if a.all_titles or TITLE_RE.search(r["title"]):
                    lo, hi = money(r["description"])
                    kept.append({"company": slug, **r, "description": r["description"][:7000],
                                 "pay_low": lo, "pay_high": hi,
                                 "remote_listed": bool(REMOTE_RE.search(r["location"]))})
    with open(a.out, "w") as f:
        for r in kept:
            f.write(json.dumps(r) + "\n")
    print(f"{total:,} open roles across {len(jobs)} boards; {len(kept):,} with product in the title -> {a.out}")


if __name__ == "__main__":
    main()

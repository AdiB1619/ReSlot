#!/usr/bin/env python3
"""ReSlot (Computer Engineering dept): master_timetable.txt -> seed.sql + conflicts_report.md

Also runs an independent Python conflict check (rooms, faculty, student groups) so the
SQL views in schema.sql can be cross-checked against it.
"""
import hashlib
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "master_timetable.txt"

DAYS = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6}
DAY_NAME = {v: k.title() for k, v in DAYS.items()}
PERIODS = {
    "P1": ("09:00", "10:00", "Period 1"), "P2": ("10:00", "11:00", "Period 2"),
    "P3": ("11:15", "12:15", "Period 3 (after short recess)"), "P4": ("12:15", "13:15", "Period 4"),
    "P5": ("14:00", "15:00", "Period 5 (after lunch)"), "P6": ("15:00", "16:00", "Period 6"),
    "P7": ("16:00", "17:00", "Golden Hour / BE Minor"),
}

# code, name, type, lab_code (the short code printed in the PDF legends)
ROOMS = [
    ("A-216", "Classroom A-216", "CLASSROOM", None), ("A1-202", "Classroom A1-202", "CLASSROOM", None),
    ("A1-203", "Classroom A1-203", "CLASSROOM", None), ("A1-201", "Classroom A1-201", "CLASSROOM", None),
    ("A1-215", "Classroom A1-215", "CLASSROOM", None), ("B-216", "Classroom B-216", "CLASSROOM", None),
    ("KRC", "Knowledge Resource Centre", "LAB", "KRC"),
    ("A-209", "Computer Vision Lab", "LAB", "CVL"), ("A-210", "ML / AI-ML Lab", "LAB", "MLL"),
    ("A1-208", "PG Lab", "LAB", "PGL"), ("A1-209", "Innovation Lab", "LAB", "INL"),
    ("A1-113", "Cyber Security Lab", "LAB", "CSL"), ("A-211", "Project Lab", "LAB", "PL"),
    ("A-212", "Research Lab", "LAB", "RL"), ("B-108", "MAC Lab", "LAB", "MACL"),
    ("A1-301", "Data Science Lab", "LAB", "DSL"),
]
EXTRA_ROOM_ALIASES = {"ML": "A-210", "AML": "A-210"}   # cells say 'ML'; legends say MLL or AML

FACULTY = {
    "AUB": "Prof. A.U. Bhosale", "BBG": "Prof. B.B. Gadekar", "BKK": "Prof. B.K. Khairnar",
    "DRS": "Prof. Darshna Sonje", "DV": "Prof. Devendra Vaidya", "GFM": None,
    "JVS": "Prof. Jit V. Shendekar", "NAW": "Dr. N.A. Wandile", "NJ": "Prof. Neha Jain",
    "NK": "Prof. Neha Kukade", "PAV": "Dr. P.A. Vikhar", "PBS": "Dr. P.B. Sahane",
    "PGA": "Dr. Pushpa G. Ambhore", "PK": "Prof. Priya Kautoo", "PP": "Prof. Pooja Pareek",
    "PT": "Prof. Pooja Thakre", "RAD": "Dr. R.A. Deshmukh", "RGK": "Prof. R.G. Khedkar",
    "RJ": "Dr. Ram Joshi", "RSK": "Prof. Rupali S. Khairnar", "SC": "Prof. Shweta Chandge",
    "SD": "Prof. Sneha Deshmukh", "SK": "Prof. Samruddhi Kulkarni", "SP": "Mrs. Sayali Patil",
    "SRP": "Prof. S.R. Paralkar (TY legend: Swati Paralkar)", "SS": "Prof. Sweta Shreyashi",
    "SSP": "Prof. Swapnali Patil", "SSS": "Prof. Shraddha S. Sadavarte", "SVK": "Dr. S.V. Kedar",
    "SW": "Prof. Shalaka Wagh", "SZ": "Prof. Shweta Zadbuke", "VB": "Prof. Vibhawari Bhujbal",
    "VVC": "Prof. V.V. Chitragar", "SOUMYA": "Prof. Soumya V.",
}
FACULTY_ALIASES = {"NW": "NAW", "SPP": "SSP", "JS": "JVS"}   # typos / variants seen in the PDF
SUBJECT_NAMES = {"SEM": "Seminar"}                           # only names the PDF actually gives

FIXED = {"MDM-II", "MDM-IV", "EIS-II", "COC-II", "MINOR-BDA", "GFM-MEETING"}   # solver must not move
OTHER_TYPE = {"GFM-MEETING", "COC-II", "EIS-II"}


def die(msg):
    sys.exit(f"ERROR: {msg}")


# ---------------------------------------------------------------- parse
def parse(path):
    divisions, cur = [], None
    for ln, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line, _, note = raw.partition(";;")
        line, note = line.strip(), note.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("DIVISION"):
            _, name, *kv = line.split()
            a = dict(x.split("=") for x in kv)
            cur = {"name": name, "level": a["level"], "room": a["room"], "groups": [], "rows": []}
            divisions.append(cur)
        elif line.startswith("GROUP"):
            _, names, *kv = line.split()
            a = dict(x.split("=") for x in kv)
            cur["groups"] += [(n, a["part"]) for n in names.split(",")]
        else:
            cur["rows"].append((ln, line, note))
    return divisions


def main():
    room_type = {r[0]: r[2] for r in ROOMS}
    room_alias = {r[3]: r[0] for r in ROOMS if r[3]} | EXTRA_ROOM_ALIASES

    def room_of(tok, where):
        if tok == "-":
            return None
        if tok in room_type:
            return tok
        if tok in room_alias:
            return room_alias[tok]
        die(f"unknown room {tok!r} ({where})")

    def fac_of(tok, where):
        if tok == "-":
            return [], []
        codes, notes = [], []
        for t in tok.split("/"):
            c = FACULTY_ALIASES.get(t, t)
            if c not in FACULTY:
                die(f"unknown faculty {t!r} ({where})")
            if c != t:
                notes.append(f"initials '{t}' in PDF read as {c}")
            codes.append(c)
        return codes, notes

    divisions = parse(SRC)
    groups = {}    # name -> dict(level, kind, parent, part)
    raw = []       # un-merged sessions

    for d in divisions:
        div = d["name"]
        groups[div] = dict(level=d["level"], kind="DIVISION", parent=None, part=None)
        for label, part in d["groups"]:
            parent = div if "/" not in label else f"{div}/{label.rsplit('/', 1)[0]}"
            kind = "ELECTIVE" if part in ("PE1", "PE4") else "BATCH"
            groups[f"{div}/{label}"] = dict(level=d["level"], kind=kind, parent=parent, part=part)

        for ln, line, note in d["rows"]:
            head, *entries = [p.strip() for p in line.split("|")]
            day, per, *rest = head.split()
            p0, _, p1 = per.partition("-")
            p1 = p1 or p0
            start, end = PERIODS[p0][0], PERIODS[p1][1]
            where = f"{div} line {ln}"
            if entries:
                parsed = [e.split() for e in entries]
                if any(len(p) != 4 for p in parsed):
                    die(f"bad entry ({where}): {line}")
                items = [(g, s, r, f) for g, s, r, f in parsed]
            else:
                subj, fac = rest
                items = [("*", subj, "@", fac)]
            for g, subj, rtok, ftok in items:
                gfull = div if g == "*" else f"{div}/{g}"
                if gfull not in groups:
                    die(f"unknown group {g!r} ({where})")
                if rtok == "@":
                    room = None if subj in FIXED else room_of(d["room"], where)
                else:
                    room = room_of(rtok, where)
                fac, notes = fac_of(ftok, where)
                if note:
                    notes.append(note)
                if not fac and subj not in FIXED:
                    notes.append("no faculty initials in the cell")
                if room is None and subj not in FIXED and not subj.endswith("-TUT"):
                    notes.append("room not specified in the timetable")
                if subj.endswith("-TUT"):
                    stype = "TUTORIAL"
                elif subj in OTHER_TYPE:
                    stype = "OTHER"
                elif room and room_type[room] == "LAB":
                    stype = "LAB"
                else:
                    stype = "LECTURE"
                raw.append(dict(day=DAYS[day], start=start, end=end, subject=subj, room=room, fac=fac,
                                groups=[gfull], type=stype, fixed=subj in FIXED,
                                raw_room=None if rtok in ("-", "@") else rtok,
                                raw_fac=None if ftok == "-" else ftok,
                                ref=f"{div} {day} {per}", notes=notes))

    # joint classes: identical slot/subject/room/faculty across groups -> ONE session with many groups
    merged, order = {}, []
    for s in raw:
        key = (s["day"], s["start"], s["end"], s["subject"], s["type"], s["room"], tuple(sorted(s["fac"])))
        if s["fac"] and key in merged:
            m = merged[key]
            m["groups"] += s["groups"]
            m["notes"] += [n for n in s["notes"] if n not in m["notes"]]
            m["ref"] += " + " + s["ref"]
            for k in ("raw_room", "raw_fac"):
                parts = ((m[k] or "").split(" | ") + (s[k] or "").split(" | "))
                m[k] = " | ".join(dict.fromkeys(p for p in parts if p)) or None
        else:
            k = key if s["fac"] else ("solo", len(order))
            merged[k] = s
            order.append(k)
    sessions = sorted((merged[k] for k in order), key=lambda s: (s["day"], s["start"], s["groups"][0]))
    for i, s in enumerate(sessions, 1):
        s["id"] = i
        s["review"] = "; ".join(dict.fromkeys(s["notes"]))

    # ------------------------------------------------ independent conflict check
    def path(g):
        p = []
        while g:
            p.append(g)
            g = groups[g]["parent"]
        return p[::-1]

    def overlap(g1, g2):
        p1, p2, k = path(g1), path(g2), 0
        while k < min(len(p1), len(p2)) and p1[k] == p2[k]:
            k += 1
        if k == 0:
            return False
        if k == len(p1) or k == len(p2):
            return True
        x, y = groups[p1[k]], groups[p2[k]]
        return not (x["part"] and x["part"] == y["part"])

    by_day = defaultdict(list)
    for s in sessions:
        by_day[s["day"]].append(s)
    room_c, fac_c, grp_c = [], [], []
    for day, lst in by_day.items():
        for i, a in enumerate(lst):
            for b in lst[i + 1:]:
                if not (a["start"] < b["end"] and b["start"] < a["end"]):
                    continue
                if a["room"] and a["room"] == b["room"]:
                    room_c.append((a, b, a["room"]))
                for f in set(a["fac"]) & set(b["fac"]):
                    fac_c.append((a, b, f))
                if any(overlap(x, y) for x in a["groups"] for y in b["groups"]):
                    grp_c.append((a, b, ""))

    def desc(s):
        return (f"{', '.join(g.split('/', 1)[-1] if '/' in g else g for g in s['groups'])} "
                f"{s['subject']} room={s['room'] or '-'} fac={'/'.join(s['fac']) or '-'}")

    def lines(title, items, what):
        out = [f"## {title} ({len(items)})", ""]
        for a, b, x in sorted(items, key=lambda t: (t[0]["day"], t[0]["start"])):
            out.append(f"- {DAY_NAME[a['day']]} {a['start']}-{a['end']} {what} {x}: "
                       f"[{a['ref']}] {desc(a)}  <>  [{b['ref']}] {desc(b)}")
        return out + [""]

    report = ["# Conflicts found in the MASTER timetable itself", "",
              "Produced by build_seed.py from master_timetable.txt. A conflict is either a transcription",
              "slip, a typo in the PDF, or a genuine clash. Resolve each in the review screen.", ""]
    report += lines("Room double-booked", room_c, "room")
    report += lines("Faculty double-booked", fac_c, "faculty")
    report += lines("Student group double-booked", grp_c, "")
    (HERE / "conflicts_report.md").write_text("\n".join(report), encoding="utf-8")

    # ------------------------------------------------ seed.sql
    def lit(x):
        if x is None:
            return "NULL"
        if isinstance(x, bool):
            return "true" if x else "false"
        if isinstance(x, (int, float)):
            return str(x)
        return "'" + str(x).replace("'", "''") + "'"

    fac_id = {c: i for i, c in enumerate(FACULTY, 1)}
    room_id = {r[0]: i for i, r in enumerate(ROOMS, 1)}
    subj_codes = sorted({s["subject"] for s in sessions})
    subj_id = {c: i for i, c in enumerate(subj_codes, 1)}
    grp_id = {g: i for i, g in enumerate(groups, 1)}      # parents are inserted before children

    pdf = Path("/mnt/user-data/uploads/Updated_TT__1_.pdf")
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest() if pdf.exists() else None   # identity of the uploaded master
    sql = ["-- Generated by build_seed.py from master_timetable.txt. Do not edit by hand.", "BEGIN;"]

    def insert(table, cols, rows):
        sql.append(f"INSERT INTO {table} ({', '.join(cols)}) VALUES")
        sql.append(",\n".join("  (" + ", ".join(lit(v) for v in r) + ")" for r in rows) + ";")

    insert("faculty", ["id", "code", "full_name"], [(fac_id[c], c, n) for c, n in FACULTY.items()])
    insert("faculty_aliases", ["alias", "faculty_id"], [(a, fac_id[c]) for a, c in FACULTY_ALIASES.items()])
    insert("rooms", ["id", "code", "name", "room_type", "lab_code"],
           [(room_id[r[0]], r[0], r[1], r[2], r[3]) for r in ROOMS])
    insert("room_aliases", ["alias", "room_id"],
           [(a, room_id[c]) for a, c in sorted((room_alias | {r[0]: r[0] for r in ROOMS}).items())])
    insert("subjects", ["id", "code", "name"], [(subj_id[c], c, SUBJECT_NAMES.get(c)) for c in subj_codes])
    insert("periods", ["code", "start_time", "end_time", "label"], [(k, *v) for k, v in PERIODS.items()])
    insert("lab_blocks", ["code", "start_time", "end_time", "note"],
           [("LB1", "09:00", "11:00", None), ("LB2", "11:15", "13:15", None), ("LB3", "14:00", "16:00", None),
            ("LB4", "15:00", "17:00", "one Friday session in the master (OE-I/PL-II Swift, TY)")])
    insert("student_groups", ["id", "name", "level", "kind", "parent_id", "partition_key"],
           [(grp_id[g], g, v["level"], v["kind"], grp_id.get(v["parent"]), v["part"]) for g, v in groups.items()])
    insert("timetable_versions", ["id", "name", "academic_year", "semester", "effective_from", "status", "source_file", "source_sha256"],
           [(1, "Master timetable A.Y. 2026-27 SEM-I", "2026-27", "SEM-I", "2026-07-06", "DRAFT", "Updated_TT.pdf", sha)])   # activated after the sessions load (master is locked once ACTIVE)
    insert("timetable_sessions",
           ["id", "version_id", "day_of_week", "start_time", "end_time", "subject_id", "room_id",
            "raw_room", "raw_faculty", "session_type", "is_fixed", "source_ref", "needs_review", "review_note"],
           [(s["id"], 1, s["day"], s["start"], s["end"], subj_id[s["subject"]],
             room_id[s["room"]] if s["room"] else None, s["raw_room"], s["raw_fac"], s["type"], s["fixed"], s["ref"],
             bool(s["review"]), s["review"] or None) for s in sessions])
    insert("session_groups", ["session_id", "group_id"],
           [(s["id"], grp_id[g]) for s in sessions for g in s["groups"]])
    insert("session_faculty", ["session_id", "faculty_id"],
           [(s["id"], fac_id[f]) for s in sessions for f in s["fac"]])
    sql.append("UPDATE timetable_versions SET status = 'ACTIVE' WHERE id = 1;")   # lock the master
    for t in ("faculty", "rooms", "subjects", "student_groups", "timetable_versions", "timetable_sessions"):
        sql.append(f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), (SELECT max(id) FROM {t}));")
    sql.append("COMMIT;")
    (HERE / "seed.sql").write_text("\n".join(sql) + "\n", encoding="utf-8")

    n_rev = sum(1 for s in sessions if s["review"])
    print(f"divisions={len(divisions)} groups={len(groups)} sessions={len(sessions)} "
          f"(raw rows={len(raw)}, joint merges={len(raw) - len(sessions)}) needs_review={n_rev}")
    print(f"conflicts: room={len(room_c)} faculty={len(fac_c)} group={len(grp_c)}")


if __name__ == "__main__":
    main()

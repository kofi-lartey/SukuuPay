import React, { useEffect, useState } from "react";
import { Download, Upload, Eye } from "lucide-react";
import Papa from "papaparse";
import api from "../../services/api";

function normalizeRow(r) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) {
    const key = String(k).replace(/^\uFEFF/, "").trim();
    out[key] = v;
  }
  return out;
}

function pick(r, ...keys) {
  const nr = normalizeRow(r);
  for (const k of keys) {
    if (nr[k] !== undefined && nr[k] !== null && String(nr[k]).trim() !== "") return nr[k];
  }
  const lower = Object.fromEntries(Object.entries(nr).map(([k, v]) => [String(k).toLowerCase().trim(), v]));
  for (const k of keys) {
    const v = lower[String(k).toLowerCase().trim()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  // fuzzy: find any key containing one of the requested keys
  for (const k of keys) {
    const kl = String(k).toLowerCase();
    for (const rk of Object.keys(nr)) {
      if (rk.toLowerCase().includes(kl) && String(nr[rk]).trim() !== "") return nr[rk];
    }
  }
  return "";
}

function toRows(kind, data) {
  if (kind === "assessments") {
    return (data || []).map((d) => ({
      title: d.title || "",
      className: d.className || "",
      subject: d.subject || "",
      dueDate: d.dueDate || "",
      instructions: d.instructions || "",
      status: d.status || "draft",
      questions: JSON.stringify(d.questions || []),
    }));
  }
  if (kind === "studyplans") {
    return (data || []).map((d) => ({
      title: d.title || "",
      description: d.description || "",
      className: d.className || "",
      subject: d.subject || "",
      term: d.term || "",
      academicYear: d.academicYear || "",
      status: d.status || "draft",
      lessons: JSON.stringify(d.lessons || []),
    }));
  }
  if (kind === "lessons") {
    return (data || []).map((d) => ({
      studyPlanId: d.studyPlanId || "",
      studyPlanTitle: d.studyPlanTitle || "",
      title: d.title || "",
      content: d.content || "",
      resourceLinks: JSON.stringify(d.resourceLinks || []),
      order: d.order || 1,
    }));
  }
  return data || [];
}

function fromRows(kind, rows) {
  const filtered = (rows || []).map(normalizeRow).filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
  if (kind === "assessments") {
    return filtered.map((r) => ({
      title: pick(r, "title", "assessmentTitle", "Assessment Title"),
      className: pick(r, "className", "targetClass", "Target Class", "class"),
      subject: pick(r, "subject", "subjectArea", "Subject Area", "Subject"),
      dueDate: pick(r, "dueDate", "deadline", "Submission Deadline", "due"),
      instructions: pick(r, "instructions"),
      status: pick(r, "status") || "draft",
      questions: (() => { try { return JSON.parse(pick(r, "questions") || "[]"); } catch { return []; } })(),
    }));
  }
  if (kind === "studyplans") {
    // Group rows by course so a multi-lesson CSV (one row per lesson) becomes one study plan.
    const groups = new Map();
    for (const r of filtered) {
      const title = pick(r, "title", "courseTitle", "Course Title", "planTitle", "Study Plan Title") || "Untitled";
      const key = title + "||" + pick(r, "className", "targetClass", "Class", "class");
      if (!groups.has(key)) {
        groups.set(key, {
          title,
          description: pick(r, "description", "Description"),
          className: pick(r, "className", "targetClass", "Class", "class"),
          subject: pick(r, "subject", "Subject"),
          term: pick(r, "term", "Term"),
          academicYear: pick(r, "academicYear", "Academic Year", "year"),
          status: pick(r, "status") || "draft",
          lessons: [],
        });
        // Handle combined "Term & Year" column
        const combinedTY = pick(r, "Term & Year");
        if (combinedTY && String(combinedTY).includes(",")) {
          const parts = String(combinedTY).split(",");
          if (!groups.get(key).term) groups.get(key).term = parts[0].trim();
          if (!groups.get(key).academicYear) groups.get(key).academicYear = parts.slice(1).join(",").trim();
        } else if (combinedTY && !groups.get(key).term) {
          groups.get(key).term = String(combinedTY).trim();
        }
      }
      const g = groups.get(key);
      const lessonTitle = pick(r, "lessonTitle", "Lesson Title", "Lesson");
      const lessonContent = pick(r, "lessonContent", "Lesson Content", "content");
      const lessonNumber = pick(r, "lessonNumber", "Lesson Number");
      const resourceLinks = [];
      const rl = pick(r, "resourceLinks", "Resource Links", "resources");
      if (rl) {
        for (const u of String(rl).split(/[;,]/)) {
          const u2 = u.trim();
          if (u2) resourceLinks.push({ title: u2, url: u2 });
        }
      }
      for (const col of ["Images", "Videos", "Documents"]) {
        const v = pick(r, col);
        if (v) {
          for (const u of String(v).split(/[,;]/)) {
            const u2 = u.trim();
            if (u2) resourceLinks.push({ title: `${col}: ${u2}`, url: u2 });
          }
        }
      }
      if (lessonTitle || lessonContent) {
        g.lessons.push({
          title: lessonTitle || `Lesson ${g.lessons.length + 1}`,
          content: lessonContent || "",
          resourceLinks,
          assessmentTitle: pick(r, "attachedAssessment", "Attached Assessment", "assessment"),
          order: Number(lessonNumber) || g.lessons.length + 1,
        });
      }
      // keep term/academicYear from "Term & Year" if combined
      if (!g.term && g.academicYear && String(g.academicYear).includes(",")) {
        const parts = String(g.academicYear).split(",");
        g.term = parts[0].trim();
        g.academicYear = parts.slice(1).join(",").trim();
      }
    }
    // Normalize combined "Term & Year" values
    for (const g of groups.values()) {
      if (g.term && String(g.term).includes(",")) {
        const parts = String(g.term).split(",");
        g.term = parts[0].trim();
        if (!g.academicYear) g.academicYear = parts.slice(1).join(",").trim();
      }
      if (g.academicYear && String(g.academicYear).includes(",")) {
        const parts = String(g.academicYear).split(",");
        if (!g.term) g.term = parts[0].trim();
        g.academicYear = parts.slice(1).join(",").trim();
      }
    }
    return Array.from(groups.values());
  }
  if (kind === "lessons") {
    return filtered.map((r) => ({
      studyPlanId: pick(r, "studyPlanId", "studyPlan"),
      title: pick(r, "title", "lessonTitle"),
      content: pick(r, "content"),
      resourceLinks: (() => { try { return JSON.parse(pick(r, "resourceLinks", "resources") || "[]"); } catch { return []; } })(),
      order: Number(pick(r, "order")) || 1,
    }));
  }
  return filtered;
}

export default function LmsBulkToolbar({ kind, onImported, onPrefill }) {
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState("csv");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [previewItems, setPreviewItems] = useState(null);
  const [rawPreview, setRawPreview] = useState(null);

  useEffect(() => {
    api.get("/teacher/classes").then((r) => {
      let cls = r.data.data?.classes || [];
      if (!cls.length) {
        api.get("/teacher/classes/available").then((r2) => {
          const c = (r2.data.data?.classes || []).map((x) => ({ className: x.className, subjects: [] }));
          setClasses(c);
          if (c.length) setSelectedClass(c[0].className);
        }).catch(() => {});
      } else {
        setClasses(cls);
        if (cls.length) {
          setSelectedClass(cls[0].className);
          if (cls[0].subjects?.length) setSelectedSubject(cls[0].subjects[0]);
        }
      }
    }).catch(() => {});
  }, []);

  const selectedClassObj = classes.find((c) => c.className === selectedClass);
  const subjectOptions = selectedClassObj?.subjects?.length ? selectedClassObj.subjects : null;

  const exportData = async () => {
    const r = await api.get(`/teacher/lms/export?kind=${kind}`);
    const rows = toRows(kind, r.data.data);
    if (format === "csv") {
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(r.data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setStatus(`Exported ${rows.length} items`);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        let items = [];
        if (file.name.endsWith(".json")) {
          items = JSON.parse(ev.target.result);
          setRawPreview(items);
        } else {
          const parsed = Papa.parse(ev.target.result, { header: true, skipEmptyLines: true });
          setRawPreview(parsed.data);
          items = fromRows(kind, parsed.data);
        }
        items = items.map((it) => ({
          ...it,
          className: it.className || selectedClass,
          subject: it.subject || selectedSubject || it.subject,
          dueDate: it.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
          title: it.title || "Untitled",
        }));
        setPreviewItems(items);
      } catch (err) {
        setStatus("Import failed: " + (err?.message || err));
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!previewItems) return;
    if (onPrefill) {
      onPrefill(previewItems);
      setPreviewItems(null);
      setStatus(`Prefilled form with ${previewItems.length} item(s)`);
      return;
    }
    try {
      const r = await api.post("/teacher/lms/import", { kind, items: previewItems });
      setStatus(`Imported ${r.data.created} items${r.data.errors?.length ? " (" + r.data.errors.length + " errors)" : ""}`);
      setPreviewItems(null);
      if (onImported) onImported();
    } catch (err) {
      setStatus("Import failed: " + (err?.message || err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); const c = classes.find((x) => x.className === e.target.value); if (c?.subjects?.length) setSelectedSubject(c.subjects[0]); }} className="border border-gray-200 rounded-lg text-xs p-1.5">
          <option value="">Select class</option>
          {classes.map((c) => <option key={c.className} value={c.className}>{c.className}</option>)}
        </select>
        {subjectOptions ? (
          <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="border border-gray-200 rounded-lg text-xs p-1.5">
            <option value="">Select subject</option>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} placeholder="Subject" className="border border-gray-200 rounded-lg text-xs p-1.5 w-24" />
        )}
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="border border-gray-200 rounded-lg text-xs p-1.5">
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <button onClick={exportData} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center space-x-1.5"><Download className="w-3.5 h-3.5" /><span>Export</span></button>
        <label className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center space-x-1.5 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /><span>Import</span>
          <input type="file" accept=".csv,.json" onChange={importData} className="hidden" />
        </label>
        {status && <span className="text-xs text-emerald-700 font-semibold">{status}</span>}
      </div>

      {previewItems && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2"><Eye className="w-4 h-4" /><span>Preview ({previewItems.length} items)</span></h3>
            <div className="flex items-center space-x-2">
              <button onClick={() => setPreviewItems(null)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700">Cancel</button>
              <button onClick={confirmImport} className="px-3 py-1.5 bg-[#006837] text-white rounded-lg text-xs font-semibold">Confirm Import</button>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {rawPreview && rawPreview.length > 0 && (
              <div className="text-[10px] text-gray-500 mb-2 break-all">
                <strong>Raw keys:</strong> {Object.keys(rawPreview[0]).join(" | ")}
                <br />
                <strong>First row:</strong> {JSON.stringify(rawPreview[0])}
              </div>
            )}
            {previewItems.map((it, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-gray-900">{it.title || "(no title)"}</p>
                <p className="text-gray-500">{it.className} · {it.subject}</p>
                {kind === "assessments" && (
                  <ul className="mt-1 space-y-1 text-gray-600">
                    {(it.questions || []).map((q, qi) => (
                      <li key={qi}>Q{qi + 1}: {q.questionText} ({q.type}, {q.points} pts)</li>
                    ))}
                    {(it.questions || []).length === 0 && <li className="text-red-500">No questions parsed</li>}
                  </ul>
                )}
                {kind === "studyplans" && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-gray-600">{it.lessons?.length || 0} lessons</p>
                    {(it.lessons || []).map((l, li) => (
                      <p key={li} className="text-[10px] text-gray-500">• {l.title || `Lesson ${li + 1}`}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}